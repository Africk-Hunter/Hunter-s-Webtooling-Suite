// SEO tool server: reads and edits <title> and <meta>/<link> tags in the project's index.html.
const FIELDS = [
  { key: 'title', tag: 'title' },
  { key: 'description', tag: 'meta', attr: 'name', name: 'description' },
  { key: 'robots', tag: 'meta', attr: 'name', name: 'robots' },
  { key: 'canonical', tag: 'link', attr: 'rel', name: 'canonical', value: 'href' },
  { key: 'og:title', tag: 'meta', attr: 'property', name: 'og:title' },
  { key: 'og:description', tag: 'meta', attr: 'property', name: 'og:description' },
  { key: 'og:image', tag: 'meta', attr: 'property', name: 'og:image' },
  { key: 'og:url', tag: 'meta', attr: 'property', name: 'og:url' },
  { key: 'og:type', tag: 'meta', attr: 'property', name: 'og:type' },
  { key: 'twitter:card', tag: 'meta', attr: 'name', name: 'twitter:card' },
]
export const SEO_KEYS = FIELDS.map((f) => f.key)

const escAttr = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const unesc = (v) => v.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const escRe = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Finds the tag for a field: { start, end, text } or null. */
function findTag(html, field) {
  if (field.tag === 'title') {
    const m = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)
    return m ? { start: m.index, end: m.index + m[0].length, text: m[0], value: unesc(m[1].trim()) } : null
  }
  const re = new RegExp(`<${field.tag}\\b[^>]*?\\b${field.attr}\\s*=\\s*(["'])${escRe(field.name)}\\1[^>]*>`, 'i')
  const m = re.exec(html)
  if (!m) return null
  const valueAttr = field.value ?? 'content'
  const v = new RegExp(`\\b${valueAttr}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i').exec(m[0])
  return { start: m.index, end: m.index + m[0].length, text: m[0], value: v ? unesc(v[2]) : '' }
}

export function parseHead(html) {
  const out = {}
  for (const field of FIELDS) out[field.key] = findTag(html, field)?.value ?? ''
  return out
}

const render = (field, value) => {
  const v = escAttr(value)
  if (field.tag === 'title') return `<title>${v}</title>`
  if (field.tag === 'link') return `<link rel="${field.name}" href="${v}">`
  return `<meta ${field.attr}="${field.name}" content="${v}">`
}

/** Applies { key: value } edits. An empty string removes the tag. Returns the new html. */
export function applyHead(html, values) {
  if (!/<\/head\s*>/i.test(html)) throw new Error('project index.html has no closing </head>')
  for (const [key, value] of Object.entries(values)) {
    const field = FIELDS.find((f) => f.key === key)
    if (!field) throw new Error(`unknown SEO field ${key}`)
    if (typeof value !== 'string' || value.length > 500 || /[\r\n]/.test(value)) throw new Error(`invalid value for ${key}`)
    const found = findTag(html, field)
    const next = value.trim()
    if (found) {
      if (!next) {
        if (field.tag === 'title') throw new Error('title cannot be empty')
        // drop the tag and its line
        const lineStart = html.lastIndexOf('\n', found.start) + 1
        const whole = !html.slice(lineStart, found.start).trim() && !html.slice(found.end).split('\n')[0].trim()
        const cutStart = whole ? lineStart : found.start
        const cutEnd = whole ? html.indexOf('\n', found.end) + 1 || html.length : found.end
        html = html.slice(0, cutStart) + html.slice(cutEnd)
      } else if (found.value !== next) {
        html = html.slice(0, found.start) + render(field, next) + html.slice(found.end)
      }
    } else if (next) {
      if (field.tag === 'title') {
        html = html.replace(/<\/head\s*>/i, () => `  <title>${escAttr(next)}</title>\n  </head>`)
      } else {
        html = html.replace(/([ \t]*)<\/head\s*>/i, (m, indent) => `${indent}  ${render(field, next)}\n${m}`)
      }
    }
  }
  return html
}

export const server = {
  read: (_payload, ctx) => parseHead(ctx.fs.read(ctx.project.abs('index.html'))),

  // payload: { values: { 'og:title': '...', description: '' } }
  apply({ values }, ctx) {
    if (!values || typeof values !== 'object' || Array.isArray(values) || !Object.keys(values).length) throw new Error('no values supplied')
    const file = ctx.project.abs('index.html')
    const before = ctx.fs.read(file)
    const after = applyHead(before, values)
    if (after === before) return { file: ctx.project.rel(file), unchanged: true }
    ctx.write(file, after, { tool: 'seo', label: `SEO: ${Object.keys(values).join(', ')}` })
    return { file: ctx.project.rel(file), unchanged: false }
  },
}
