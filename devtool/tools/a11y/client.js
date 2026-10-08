// A11y tool: scans the page for contrast, alt text, heading order, tap target and naming problems.
// `audit` is a named export so it can be tested without the overlay.
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char])

const MIN_TARGET = 24 // WCAG 2.2 AA (2.5.8) minimum target size in CSS px
const INTERACTIVE = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[tabindex]:not([tabindex="-1"])'

/** Parses computed `rgb()/rgba()` values; returns null for anything else. */
export function parseColor(value) {
  const m = /^rgba?\(([^)]+)\)$/.exec(String(value).trim())
  if (!m) return null
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map((part) => (part.endsWith('%') ? parseFloat(part) / 100 : parseFloat(part)))
  if (parts.length < 3 || parts.some(Number.isNaN)) return null
  return { r: parts[0], g: parts[1], b: parts[2], a: Math.min(1, Math.max(0, parts.length > 3 ? parts[3] : 1)) }
}

const luminance = ({ r, g, b }) => {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const over = (top, bottom) => {
  const a = top.a + bottom.a * (1 - top.a)
  if (!a) return { r: 0, g: 0, b: 0, a: 0 }
  const mix = (t, b) => (t * top.a + b * bottom.a * (1 - top.a)) / a
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a }
}

/** Effective background colour, or null when an image/gradient makes it unknowable. */
function backgroundOf(el, view) {
  let color = { r: 0, g: 0, b: 0, a: 0 }
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const cs = view.getComputedStyle(node)
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
    const bg = parseColor(cs.backgroundColor)
    if (bg) color = over(color, bg)
    if (color.a >= 0.999) return color
  }
  return over(color, { r: 255, g: 255, b: 255, a: 1 })
}

const accessibleName = (el) => !!(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
  || el.getAttribute('title') || el.textContent || '').trim()
  || [...el.querySelectorAll('img[alt]')].some((img) => img.alt.trim())

const hasLabel = (el, doc) => {
  if (el.getAttribute('aria-label')?.trim() || el.getAttribute('aria-labelledby') || el.getAttribute('title')?.trim()) return true
  if (el.closest('label')) return true
  return !!el.id && !!doc.querySelector(`label[for="${CSS.escape(el.id)}"]`)
}

/**
 * Returns [{ rule, severity, el, message }]. `skip(el)` excludes overlay elements;
 * `rect(el)` is injectable because jsdom has no layout. Zero-size elements count as hidden.
 */
export function audit(doc, { skip = () => false, rect = (el) => el.getBoundingClientRect() } = {}) {
  const view = doc.defaultView
  const issues = []
  const add = (rule, severity, el, message) => issues.push({ rule, severity, el, message })
  const visible = (el) => { const r = rect(el); return r.width > 0 && r.height > 0 }
  const all = [...doc.body.querySelectorAll('*')].filter((el) => !skip(el) && !el.closest('[aria-hidden="true"]'))

  for (const img of all.filter((el) => el.tagName === 'IMG')) {
    if (!img.hasAttribute('alt') && img.getAttribute('role') !== 'presentation') add('img-alt', 'error', img, 'Image has no alt attribute')
  }

  let lastLevel = 0
  for (const heading of all.filter((el) => /^H[1-6]$/.test(el.tagName))) {
    const level = Number(heading.tagName[1])
    if (lastLevel && level > lastLevel + 1) add('heading-order', 'warning', heading, `Heading jumps from h${lastLevel} to h${level}`)
    lastLevel = level
  }
  if (!all.some((el) => el.tagName === 'H1')) add('heading-order', 'warning', doc.body, 'Page has no h1')

  for (const el of all.filter((node) => node.matches(INTERACTIVE) && visible(node))) {
    const r = rect(el)
    const isInlineLink = el.tagName === 'A' && view.getComputedStyle(el).display === 'inline'
    if (!isInlineLink && (r.width < MIN_TARGET || r.height < MIN_TARGET)) {
      add('tap-target', 'warning', el, `Target is ${Math.round(r.width)}×${Math.round(r.height)}px (minimum ${MIN_TARGET}×${MIN_TARGET})`)
    }
    if (['A', 'BUTTON'].includes(el.tagName) || /^(button|link)$/.test(el.getAttribute('role') ?? '')) {
      if (!accessibleName(el)) add('name', 'error', el, `${el.tagName.toLowerCase()} has no accessible name`)
    } else if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && !hasLabel(el, doc)
      && !['submit', 'button', 'reset', 'image'].includes(el.type)) {
      add('label', 'error', el, 'Form control has no label')
    }
  }

  for (const el of all) {
    if (!visible(el)) continue
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
    const cs = view.getComputedStyle(el)
    const fg = parseColor(cs.color)
    const bg = backgroundOf(el, view)
    if (!fg || !bg) continue
    const text = over({ ...fg, a: fg.a * (parseFloat(cs.opacity) || 1) }, bg)
    const size = parseFloat(cs.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
    const need = large ? 3 : 4.5
    const ratio = contrastRatio(text, bg)
    if (ratio < need) add('contrast', 'error', el, `Contrast ${ratio.toFixed(2)}:1, needs ${need}:1`)
  }
  return issues
}

let box, offs = []

export default {
  id: 'a11y',
  name: 'A11y',
  hotkey: 'a',

  activate(api) {
    box = api.box({ outline: '2px solid #ef4444' })
    const render = () => {
      const host = api.panel.el.getRootNode().host
      const issues = audit(document, { skip: (el) => el === host || host.contains(el) })
      const errors = issues.filter((i) => i.severity === 'error').length
      api.panel.set(`<b>Accessibility</b>
        <div class="muted" style="margin:4px 0 8px">${issues.length ? `${errors} errors, ${issues.length - errors} warnings` : 'No issues found'}</div>
        <div class="row"><button class="s rescan">Re-scan</button></div>
        ${issues.map((issue, index) => `<div class="scale-sample a11y-issue" data-index="${index}" style="cursor:pointer">
          <small>${esc(issue.rule)} · ${issue.severity}</small>
          <span style="white-space:normal">${esc(issue.message)}</span>
          <small>${esc(api.selectorFor(issue.el))}</small></div>`).join('')}`)
      const panel = api.panel.el
      panel.querySelector('.rescan').onclick = render
      panel.querySelectorAll('.a11y-issue').forEach((row) => {
        row.onclick = () => {
          const el = issues[Number(row.dataset.index)].el
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
          box.follow(el)
        }
      })
    }
    render()
    offs.push(api.on('write', () => setTimeout(render, 300)))
  },

  deactivate() {
    offs.forEach((off) => off())
    offs = []
    box?.destroy()
  },
}
