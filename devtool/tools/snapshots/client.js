// Snapshots tool: capture the page before and after a change, then compare side by side, as a blend overlay or as a pixel diff.
// Capture rasterises a styled clone of the DOM through an SVG <foreignObject>: same-origin images are inlined,
// cross-origin images and web fonts are not available to the rasteriser, so those render as fallbacks.
let layer, snapshots = [], leftId = null, rightId = null, mode = 'side'

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]))

const MAX_SNAPSHOTS = 8
const MAX_NODES = 6000

/**
 * Compares two RGBA buffers of possibly different sizes. Pixels outside either image count as changed.
 * Returns { changed, total, ratio, diff } where diff is an RGBA buffer (W×H of the larger size) with changed pixels in magenta.
 */
export function diffPixels(a, b, threshold = 24) {
  const width = Math.max(a.width, b.width), height = Math.max(a.height, b.height)
  const diff = new Uint8ClampedArray(width * height * 4)
  let changed = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const inA = x < a.width && y < a.height, inB = x < b.width && y < b.height
      let differs = inA !== inB
      let gray = 255
      if (inA && inB) {
        const ia = (y * a.width + x) * 4, ib = (y * b.width + x) * 4
        const delta = Math.max(
          Math.abs(a.data[ia] - b.data[ib]),
          Math.abs(a.data[ia + 1] - b.data[ib + 1]),
          Math.abs(a.data[ia + 2] - b.data[ib + 2]),
          Math.abs(a.data[ia + 3] - b.data[ib + 3]),
        )
        differs = delta > threshold
        gray = Math.round((a.data[ia] + a.data[ia + 1] + a.data[ia + 2]) / 3 * 0.35 + 255 * 0.65)
      }
      if (differs) {
        changed++
        diff[i] = 236; diff[i + 1] = 72; diff[i + 2] = 153; diff[i + 3] = 255
      } else {
        diff[i] = diff[i + 1] = diff[i + 2] = gray
        diff[i + 3] = 255
      }
    }
  }
  const total = width * height
  return { changed, total, ratio: total ? changed / total : 0, diff, width, height }
}

function inlineImages(source, clone) {
  const from = source.querySelectorAll('img'), to = clone.querySelectorAll('img')
  from.forEach((img, i) => {
    try {
      if (!img.complete || !img.naturalWidth) return
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      to[i].setAttribute('src', canvas.toDataURL('image/png'))
      to[i].removeAttribute('srcset')
    } catch { /* tainted by a cross-origin image */ }
  })
}

function styledClone() {
  const root = document.documentElement
  const clone = root.cloneNode(true)
  const sourceNodes = [root, ...root.querySelectorAll('*')]
  if (sourceNodes.length > MAX_NODES) throw new Error(`Page has ${sourceNodes.length} elements; snapshots are limited to ${MAX_NODES}.`)
  const cloneNodes = [clone, ...clone.querySelectorAll('*')]
  sourceNodes.forEach((node, i) => {
    const target = cloneNodes[i]
    if (node.id === '__webtool_host' || node.tagName === 'SCRIPT') { target.remove?.(); return }
    const cs = getComputedStyle(node)
    let css = ''
    for (let p = 0; p < cs.length; p++) css += `${cs[p]}:${cs.getPropertyValue(cs[p])};`
    target.setAttribute('style', css)
  })
  inlineImages(root, clone)
  clone.querySelectorAll('script,link[rel=stylesheet],style').forEach((node) => node.remove())
  return clone
}

async function capture() {
  const width = document.documentElement.clientWidth
  const height = Math.min(document.documentElement.scrollHeight, 8000)
  const clone = styledClone()
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  const xml = new XMLSerializer().serializeToString(clone)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`
  const image = new Image()
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = () => reject(new Error('The browser could not rasterise this page'))
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0)
  return { canvas, width, height }
}

const pixels = (canvas) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { data, width: canvas.width, height: canvas.height }
}

function show(api) {
  layer?.remove()
  const left = snapshots.find((s) => s.id === leftId), right = snapshots.find((s) => s.id === rightId)
  if (!left || !right) return
  layer = document.createElement('div')
  layer.style.cssText = 'position:fixed;inset:0;background:#0b0c0e;overflow:auto;pointer-events:auto;z-index:1'
  const bar = document.createElement('div')
  bar.style.cssText = 'position:sticky;top:0;display:flex;gap:8px;align-items:center;padding:8px 12px;background:#14161a;color:#e8eaed;z-index:2'
  const close = document.createElement('button')
  close.textContent = 'Close'
  close.onclick = () => { layer.remove(); layer = null }
  bar.append(close)
  const body = document.createElement('div')
  body.style.cssText = 'padding:12px'
  layer.append(bar, body)
  const add = (snap, label) => {
    const wrap = document.createElement('figure')
    wrap.style.cssText = 'margin:0;color:#9aa0a6'
    wrap.append(label)
    snap.canvas.style.cssText = 'display:block;max-width:100%;height:auto;background:#fff'
    return wrap
  }
  const copy = (snap) => {
    const c = document.createElement('canvas')
    c.width = snap.canvas.width; c.height = snap.canvas.height
    c.getContext('2d').drawImage(snap.canvas, 0, 0)
    c.style.cssText = 'display:block;max-width:100%;height:auto;background:#fff'
    return c
  }
  if (mode === 'side') {
    body.style.cssText += ';display:grid;grid-template-columns:1fr 1fr;gap:12px'
    for (const snap of [left, right]) {
      const fig = add(snap, snap.label)
      fig.append(copy(snap))
      body.append(fig)
    }
  } else if (mode === 'blend') {
    const stack = document.createElement('div')
    stack.style.cssText = 'position:relative;max-width:100%'
    const a = copy(left), b = copy(right)
    b.style.cssText += ';position:absolute;inset:0;opacity:.5'
    stack.append(a, b)
    const slider = document.createElement('input')
    slider.type = 'range'; slider.min = 0; slider.max = 100; slider.value = 50
    slider.oninput = () => { b.style.opacity = slider.value / 100 }
    bar.append(`${left.label} ↔ ${right.label}`, slider)
    body.append(stack)
  } else {
    const result = diffPixels(pixels(left.canvas), pixels(right.canvas))
    const out = document.createElement('canvas')
    out.width = result.width; out.height = result.height
    out.getContext('2d').putImageData(new ImageData(result.diff, result.width, result.height), 0, 0)
    out.style.cssText = 'display:block;max-width:100%;height:auto'
    bar.append(`${(result.ratio * 100).toFixed(2)}% of pixels changed`)
    body.append(out)
  }
  api.root.append(layer)
}

export default {
  id: 'snapshots',
  name: 'Snapshots',
  hotkey: 'p',

  activate(api) {
    const render = (message = '') => {
      const options = (selected) => snapshots.map((s) => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${esc(s.label)}</option>`).join('')
      api.panel.set(`<b>Snapshots</b>
        <div class="muted" style="margin:4px 0 8px">Capture before and after a change, then compare.</div>
        <div class="row"><input class="label" placeholder="label (optional)"><button class="capture">Capture</button></div>
        ${snapshots.length >= 2 ? `<div class="row"><label>before</label><select class="left">${options(leftId)}</select></div>
          <div class="row"><label>after</label><select class="right">${options(rightId)}</select></div>
          <div class="row">${[['side', 'Side by side'], ['blend', 'Blend'], ['diff', 'Diff']].map(([m, t]) =>
    `<button class="s mode" data-mode="${m}">${t}</button>`).join('')}</div>` : '<div class="muted">Capture at least two snapshots to compare.</div>'}
        <div class="muted msg">${esc(message)}</div>`)
      const panel = api.panel.el
      panel.querySelector('.capture').onclick = async (event) => {
        event.target.disabled = true
        try {
          const shot = await capture()
          const time = new Date().toLocaleTimeString()
          const label = panel.querySelector('.label').value.trim() || `Snapshot ${snapshots.length + 1}`
          snapshots.push({ id: String(Date.now()), label: `${label} · ${time}`, ...shot })
          if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift()
          rightId = snapshots.at(-1).id
          leftId = snapshots.at(-2)?.id ?? null
          render('Captured.')
        } catch (error) {
          render('Error: ' + error.message)
        }
      }
      panel.querySelector('.left')?.addEventListener('change', (event) => { leftId = event.target.value })
      panel.querySelector('.right')?.addEventListener('change', (event) => { rightId = event.target.value })
      panel.querySelectorAll('.mode').forEach((button) => {
        button.onclick = () => { mode = button.dataset.mode; show(api) }
      })
    }
    render()
  },

  deactivate() {
    layer?.remove()
    layer = null
  },
}
