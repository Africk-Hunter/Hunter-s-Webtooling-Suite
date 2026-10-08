// Images tool: size warnings for <img> elements, and drop-in image swap that rewrites the source reference.
let box, current

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]))
const kb = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`)

export const LARGE_BYTES = 500 * 1024

/** Warnings for one image. `natural`/`rendered` are {w,h}; `bytes` may be null (unknown). */
export function imageWarnings({ natural, rendered, bytes = null, dpr = 1, hasDimensions = true, svg = false }) {
  const out = []
  if (bytes != null && bytes > LARGE_BYTES) out.push(`Large file (${kb(bytes)}). Compress it or serve a smaller format.`)
  if (!svg && rendered.w > 0 && natural.w > 0) {
    const need = rendered.w * dpr
    if (natural.w > need * 1.5) out.push(`Oversized: ${natural.w}×${natural.h} shown at ${Math.round(rendered.w)}×${Math.round(rendered.h)} (needs about ${Math.ceil(need)}px wide).`)
    else if (natural.w < need * 0.75) out.push(`Low resolution: ${natural.w}px wide stretched to ${Math.round(need)} device px; may look blurry.`)
  }
  if (!hasDimensions) out.push('No width/height attributes; the page can shift as the image loads.')
  return out
}

const readBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})

const warningsFor = (img, bytes) => imageWarnings({
  natural: { w: img.naturalWidth, h: img.naturalHeight },
  rendered: { w: img.clientWidth, h: img.clientHeight },
  bytes,
  dpr: window.devicePixelRatio || 1,
  hasDimensions: (img.hasAttribute('width') && img.hasAttribute('height')) || /height|aspect/.test(img.getAttribute('style') ?? ''),
  svg: /\.svg(\?|$)/i.test(img.currentSrc || img.src),
})

export default {
  id: 'images',
  name: 'Images',
  hotkey: 'g',

  activate(api) {
    box = api.box({ outline: '2px solid #22d3ee' })
    api.panel.set(`<b>Images</b><div class="muted" style="margin:4px 0 8px">Click an image to check its size and swap the file.</div>
      <div class="row"><button class="s scan">Scan page</button></div><div class="scan-out"></div>`)
    const scan = async () => {
      const out = api.panel.el.querySelector('.scan-out')
      const imgs = [...document.images].filter((img) => !img.closest('#__webtool_host')).slice(0, 60)
      const rows = []
      let sizes = []
      try { sizes = await api.rpc('sizes', { srcs: imgs.map((img) => img.currentSrc || img.src) }) } catch { /* sizes unavailable */ }
      for (const [i, img] of imgs.entries()) {
        const bytes = sizes[i] ?? null
        const warnings = warningsFor(img, bytes)
        if (warnings.length) rows.push({ img, warnings })
      }
      out.innerHTML = rows.length ? rows.map(({ img, warnings }, i) => `<div class="scale-sample img-row" data-i="${i}" style="cursor:pointer">
        <small>${esc(api.selectorFor(img))}</small><span style="white-space:normal">${esc(warnings.join(' '))}</span></div>`).join('')
        : '<div class="muted">No image problems found.</div>'
      out.querySelectorAll('.img-row').forEach((row) => {
        row.onclick = () => { const img = rows[Number(row.dataset.i)].img; img.scrollIntoView({ block: 'center' }); api.select(img) }
      })
    }
    api.panel.el.querySelector('.scan').onclick = scan
  },

  async onSelect(el, api) {
    if (el.tagName !== 'IMG') return
    current = el
    box.follow(el)
    const src = el.currentSrc || el.src
    api.panel.set(`<b>Image · ${esc(api.selectorFor(el))}</b>
      <div class="muted" style="word-break:break-all;margin:4px 0">${esc(src)}</div>
      <div class="info muted">checking…</div>
      <label class="drop" style="display:block;border:1px dashed #3a3f47;border-radius:6px;padding:14px;text-align:center;margin:8px 0;cursor:pointer">
        Drop a replacement here or click to choose
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml" hidden>
      </label>
      <div class="muted msg"></div>`)
    const panel = api.panel.el
    let info = { bytes: null, refs: [] }
    try { info = await api.rpc('inspect', { src }) } catch { /* remote image */ }
    if (current !== el) return
    const warnings = warningsFor(el, info.bytes)
    panel.querySelector('.info').innerHTML = `${el.naturalWidth}×${el.naturalHeight} natural · ${Math.round(el.clientWidth)}×${Math.round(el.clientHeight)} shown${info.bytes != null ? ` · ${kb(info.bytes)}` : ''}
      ${warnings.map((w) => `<div style="color:#fbbf24;margin-top:4px">⚠ ${esc(w)}</div>`).join('')}
      <div style="margin-top:4px">${info.refs.length ? `Referenced at ${info.refs.map((r) => `${esc(r.file)}:${r.line}`).join(', ')}` : 'No source reference found; swapping is unavailable.'}</div>`
    const swap = async (file) => {
      const msg = panel.querySelector('.msg')
      if (info.refs.length !== 1) return (msg.textContent = info.refs.length ? 'Several references match; edit the source by hand.' : 'No source reference found.')
      if (file.size > 10 * 1024 * 1024) return (msg.textContent = 'Image is larger than 10MB.')
      try {
        const ref = info.refs[0]
        const result = await api.rpc('swap', { src, name: file.name.replace(/[^\w.-]/g, '-'), data: await readBase64(file), file: ref.file, line: ref.line, start: ref.start })
        msg.textContent = `Saved ${result.asset} and updated ${result.file}`
      } catch (error) {
        msg.textContent = 'Error: ' + error.message
      }
    }
    const input = panel.querySelector('input[type=file]')
    input.onchange = () => input.files[0] && swap(input.files[0])
    const drop = panel.querySelector('.drop')
    drop.ondragover = (event) => event.preventDefault()
    drop.ondrop = (event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) swap(file) }
  },

  deactivate() {
    box?.destroy()
    current = null
  },
}
