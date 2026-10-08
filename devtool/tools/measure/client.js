// Measure tool: spacing ruler, alignment guides and a grid overlay.
// Select an element, then hover another to see the pixel distances and shared edges.
// `measure` is a named export so the geometry can be tested without a DOM.

const overlap = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1)
const round = (n) => Math.round(n * 10) / 10

/** Distance segments between rect `a` (anchor) and rect `b` (hovered). Rects are {left,top,right,bottom}. */
export function measure(a, b) {
  const segments = []
  const seg = (orient, x1, y1, x2, y2) => {
    const px = round(orient === 'h' ? Math.abs(x2 - x1) : Math.abs(y2 - y1))
    if (px > 0) segments.push({ orient, x1, y1, x2, y2, px })
  }
  const inside = (inner, outer) => inner.left >= outer.left && inner.right <= outer.right
    && inner.top >= outer.top && inner.bottom <= outer.bottom
  const nested = inside(b, a) ? [b, a] : inside(a, b) ? [a, b] : null
  if (nested) {
    const [inner, outer] = nested
    const cx = (inner.left + inner.right) / 2, cy = (inner.top + inner.bottom) / 2
    seg('h', outer.left, cy, inner.left, cy)
    seg('h', inner.right, cy, outer.right, cy)
    seg('v', cx, outer.top, cx, inner.top)
    seg('v', cx, inner.bottom, cx, outer.bottom)
    return segments
  }
  const xo = overlap(a.left, a.right, b.left, b.right)
  const yo = overlap(a.top, a.bottom, b.top, b.bottom)
  const yMid = yo > 0 ? (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2 : (a.top + a.bottom) / 2
  const xMid = xo > 0 ? (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2 : (a.left + a.right) / 2
  if (b.left >= a.right) seg('h', a.right, yMid, b.left, yMid)
  else if (a.left >= b.right) seg('h', b.right, yMid, a.left, yMid)
  if (b.top >= a.bottom) seg('v', xMid, a.bottom, xMid, b.top)
  else if (a.top >= b.bottom) seg('v', xMid, b.bottom, xMid, a.top)
  return segments
}

/** Edges (left/centre/right, top/middle/bottom) shared within `tolerance` px. */
export function alignments(a, b, tolerance = 1) {
  const xs = (r) => [['left', r.left], ['center', (r.left + r.right) / 2], ['right', r.right]]
  const ys = (r) => [['top', r.top], ['middle', (r.top + r.bottom) / 2], ['bottom', r.bottom]]
  const out = []
  for (const [name, x] of xs(a)) for (const [other, bx] of xs(b)) if (Math.abs(x - bx) <= tolerance) out.push({ axis: 'x', at: x, a: name, b: other })
  for (const [name, y] of ys(a)) for (const [other, by] of ys(b)) if (Math.abs(y - by) <= tolerance) out.push({ axis: 'y', at: y, a: name, b: other })
  return out
}

/** How far a length is from the nearest grid multiple (0 means on-grid). */
export const gridOffset = (value, size) => round(Math.abs(value - Math.round(value / size) * size))

let layer, anchor, hovered, grid = 8, gridOn = false, gridEl, cleanup = []

const rectOf = (el) => {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
}

function line(style, text) {
  const el = document.createElement('div')
  el.style.cssText = `position:fixed;pointer-events:none;${style}`
  if (text != null) {
    const label = document.createElement('span')
    label.textContent = text
    label.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#ec4899;color:#fff;font:11px system-ui;padding:0 4px;border-radius:3px;white-space:nowrap'
    el.appendChild(label)
  }
  layer.appendChild(el)
}

function draw() {
  layer.replaceChildren()
  if (!anchor || !document.contains(anchor)) return
  const a = rectOf(anchor)
  if (!hovered || hovered === anchor) return
  const b = rectOf(hovered)
  for (const s of measure(a, b)) {
    const css = s.orient === 'h'
      ? `left:${Math.min(s.x1, s.x2)}px;top:${s.y1}px;width:${Math.abs(s.x2 - s.x1)}px;height:0;border-top:1px solid #ec4899`
      : `left:${s.x1}px;top:${Math.min(s.y1, s.y2)}px;height:${Math.abs(s.y2 - s.y1)}px;width:0;border-left:1px solid #ec4899`
    line(css, s.px)
  }
  for (const g of alignments(a, b)) {
    line(g.axis === 'x'
      ? `left:${g.at}px;top:0;height:100vh;width:0;border-left:1px dashed #38bdf8`
      : `top:${g.at}px;left:0;width:100vw;height:0;border-top:1px dashed #38bdf8`)
  }
}

function renderGrid() {
  gridEl.style.display = gridOn ? 'block' : 'none'
  gridEl.style.backgroundImage = `linear-gradient(to right, rgba(56,189,248,.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,.25) 1px, transparent 1px)`
  gridEl.style.backgroundSize = `${grid}px ${grid}px`
}

export default {
  id: 'measure',
  name: 'Measure',
  hotkey: 'm',

  activate(api) {
    layer = document.createElement('div')
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none'
    gridEl = document.createElement('div')
    gridEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;display:none'
    api.root.append(gridEl, layer)
    anchor = hovered = null
    api.panel.set(`<b>Measure</b>
      <div class="muted" style="margin:4px 0 8px">Click an element, then hover another to see distances (pink) and shared edges (blue).</div>
      <div class="row"><label for="grid-size">grid</label><input id="grid-size" type="number" min="2" max="128" value="${grid}"><button class="s grid-toggle">${gridOn ? 'Hide' : 'Show'}</button></div>
      <div class="muted info"></div>`)
    const panel = api.panel.el
    const sync = () => {
      grid = Math.min(128, Math.max(2, Number(panel.querySelector('#grid-size').value) || 8))
      renderGrid()
      info()
    }
    const info = () => {
      const out = panel.querySelector('.info')
      if (!anchor) return (out.textContent = '')
      const r = anchor.getBoundingClientRect()
      const off = (label, v) => `${label} ${round(v)}px${gridOffset(v, grid) ? ` (off-grid by ${gridOffset(v, grid)})` : ''}`
      out.textContent = [off('width', r.width), off('height', r.height), off('x', r.left + scrollX), off('y', r.top + scrollY)].join(' · ')
    }
    panel.querySelector('#grid-size').oninput = sync
    panel.querySelector('.grid-toggle').onclick = (event) => {
      gridOn = !gridOn
      event.target.textContent = gridOn ? 'Hide' : 'Show'
      sync()
    }
    renderGrid()
    const host = api.root.host
    const onMove = (event) => {
      if (!anchor || event.composedPath().includes(host)) return
      const target = document.elementFromPoint(event.clientX, event.clientY)
      if (target && target !== hovered) { hovered = target; draw() }
    }
    addEventListener('mousemove', onMove, true)
    cleanup = [
      () => removeEventListener('mousemove', onMove, true),
      api.on('select', (el) => { anchor = el; hovered = null; draw(); info() }),
      api.on('scroll', draw),
      api.on('resize', draw),
    ]
    if (api.selected) { anchor = api.selected; info() }
  },

  deactivate() {
    cleanup.forEach((fn) => fn())
    cleanup = []
    layer?.remove()
    gridEl?.remove()
    anchor = hovered = null
  },
}
