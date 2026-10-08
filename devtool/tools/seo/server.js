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
// One pass so "&amp;lt;" decodes to "&lt;" and not "<".
const ENTITIES = { quot: '"', apos: "'", lt: '<', gt: '>', amp: '&', nbsp: ' ' }
const unesc = (v) => v.replace(/&(#x[\da-f]+|#\d+|quot|apos|lt|gt|amp|nbsp);/gi, (entity, code) => {
  if (code[0] !== '#') return ENTITIES[code.toLowerCase()]
  const number = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10)
  return number <= 0x10ffff ? String.fromCodePoint(number) : entity
})

const RAW_TEXT = new Set(['script', 'style', 'textarea'])
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/y

/**
 * Start tags in the document head, in order: { name, start, end, attrs }. Quoted attribute values may contain `>`;
 * comments and script/style/textarea bodies are skipped; scanning stops at </head> or <body>.
 */
function headTags(html) {
  const tags = []
  let i = 0
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt < 0) break
    if (html.startsWith('<!--', lt)) {
      const close = html.indexOf('-->', lt + 4)
      i = close < 0 ? html.length : close + 3
      continue
    }
    if (/^<\/head\b/i.test(html.slice(lt, lt + 7))) break
    const open = /^<([a-z][\w:-]*)/i.exec(html.slice(lt, lt + 64))
    if (!open) { i = lt + 1; continue }
    const name = open[1].toLowerCase()
    if (name === 'body') break
    const attrs = {}
    let j = lt + open[0].length
    while (j < html.length) {
      while (j < html.length && /[\s/]/.test(html[j])) j++
      if (html[j] === '>') break
      ATTRIBUTE.lastIndex = j
      const a = ATTRIBUTE.exec(html)
      if (!a) { j++; continue }
      const key = a[1].toLowerCase()
      if (!(key in attrs)) attrs[key] = a[2] ?? a[3] ?? a[4] ?? ''
      j = ATTRIBUTE.lastIndex
    }
    const end = Math.min(j + 1, html.length)
    tags.push({ name, start: lt, end, attrs })
    i = end
    if (RAW_TEXT.has(name)) {
      const close = html.toLowerCase().indexOf('</' + name, end)
      i = close < 0 ? html.length : close
    }
  }
  return tags
}

/** Finds the tag for a field: { start, end, text, value } or null. */
function findTag(html, field) {
  const tags = headTags(html)
  if (field.tag === 'title') {
    const open = tags.find((t) => t.name === 'title')
    if (!open) return null
    const close = /<\/title\s*>/i.exec(html.slice(open.end))
    if (!close) return null
    const end = open.end + close.index + close[0].length
    return { start: open.start, end, text: html.slice(open.start, end), value: unesc(html.slice(open.end, open.end + close.index).trim()) }
  }
  const tag = tags.find((t) => t.name === field.tag
    && (t.attrs[field.attr] ?? '').toLowerCase().split(/\s+/).includes(field.name))
  if (!tag) return null
  return { start: tag.start, end: tag.end, text: html.slice(tag.start, tag.end), value: unesc(tag.attrs[field.value ?? 'content'] ?? '') }
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
