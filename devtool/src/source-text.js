// Find / replace a rendered text string inside TS/TSX source (string literals and JSX text).
// No AST: matches the exact rendered text, so it works for config strings used via {expr} too.

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const escJs = (s, q) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').split(q).join('\\' + q)

function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
    if (code[0] === '#') {
      const number = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10)
      return Number.isFinite(number) && number <= 0x10ffff ? String.fromCodePoint(number) : entity
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' })[code.toLowerCase()] ?? entity
  })
}

function decodeTemplateChunk(text) {
  return text.replace(/\\([\\`$])/g, '$1').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
}

function templateMatches(content, text) {
  const matches = []
  for (let start = 0; start < content.length; start++) {
    if (content[start] !== '`' || content[start - 1] === '\\') continue
    let end = start + 1
    while (end < content.length && (content[end] !== '`' || content[end - 1] === '\\')) end++
    if (end >= content.length) continue
    const raw = content.slice(start + 1, end)
    const expressions = [...raw.matchAll(/\$\{([^{}]*)\}/g)]
    let rendered = ''
    let cursor = 0
    let safe = true
    for (const expression of expressions) {
      rendered += decodeTemplateChunk(raw.slice(cursor, expression.index))
      const value = expression[1].trim()
      if (/^(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")$/.test(value)) {
        rendered += value.slice(1, -1).replace(/\\(['"\\nrt])/g, (_, escaped) => ({
          n: '\n', r: '\r', t: '\t',
        })[escaped] ?? escaped)
      } else if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) rendered += value
      else if (value === 'true' || value === 'false' || value === 'null') rendered += value
      else { safe = false; break }
      cursor = expression.index + expression[0].length
    }
    if (!safe) continue
    rendered += decodeTemplateChunk(raw.slice(cursor))
    if (rendered === text) {
      matches.push({ start: start + 1, length: raw.length, line: content.slice(0, start).split('\n').length, kind: 'template', quote: '`' })
    }
    start = end
  }
  return matches
}

function jsxContentMatches(content, text) {
  const root = { children: [] }
  const stack = [root]
  const tokens = /<!--[\s\S]*?-->|<\/?[A-Za-z][\w:.-]*(?:\s[^<>]*?)?\/?>|\{(?:[^{}]|\{[^{}]*\})*\}|[^<{]+/g
  for (const match of content.matchAll(tokens)) {
    const token = match[0]
    if (token.startsWith('<!--')) continue
    if (token[0] === '{') {
      stack.at(-1).children.push({ dynamic: true })
      continue
    }
    if (token.startsWith('</')) {
      const name = token.slice(2).match(/^[\w:.-]+/)?.[0]
      const current = stack.at(-1)
      if (stack.length > 1 && current.name === name) {
        current.end = match.index
        stack.pop()
      }
      continue
    }
    if (token[0] === '<') {
      const name = token.slice(1).match(/^[\w:.-]+/)?.[0]
      if (!name) continue
      const node = { name, start: match.index + token.length, children: [] }
      stack.at(-1).children.push(node)
      if (!token.endsWith('/>') && !['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(name)) stack.push(node)
      else node.end = node.start
      continue
    }
    stack.at(-1).children.push({ text: decodeEntities(token), start: match.index, end: match.index + token.length, raw: token })
  }

  const matches = []
  const rendered = (node) => {
    if (node.dynamic) return null
    if (Object.hasOwn(node, 'text')) return node.text
    if (!node.children) return ''
    const values = node.children.map(rendered)
    return values.some((value) => value === null) ? null : values.join('')
  }
  const visit = (node) => {
    for (const child of node.children ?? []) {
      if (child.name && child.end !== undefined) {
        const value = rendered(child)
        if (value !== null && value.trim().replace(/\s+/g, ' ') === text.trim().replace(/\s+/g, ' ')
          && child.children.length) {
          matches.push({
            start: child.start,
            length: child.end - child.start,
            line: content.slice(0, child.start).split('\n').length,
            kind: 'jsx-rich',
          })
        }
      }
      visit(child)
    }
  }
  visit(root)
  return matches
}

/** @returns {{start:number,length:number,line:number,kind:'string'|'jsx',quote?:string}[]} */
export function findText(content, text, { jsx = true } = {}) {
  const out = []
  const lineAt = (i) => content.slice(0, i).split('\n').length
  for (const q of ["'", '"', '`']) {
    const src = escJs(text, q)
    const re = new RegExp(escRe(q + src) + '(?=' + escRe(q) + ')', 'g')
    for (const m of content.matchAll(re)) out.push({ start: m.index + 1, length: src.length, line: lineAt(m.index), kind: 'string', quote: q })
  }
  out.push(...templateMatches(content, text))
  if (jsx) {
    out.push(...jsxContentMatches(content, text))
    const re = new RegExp('(>|\\n)([ \\t]*)(' + escRe(text) + ')[ \\t]*(?=<|\\n|\\{)', 'g')
    for (const m of content.matchAll(re)) {
      out.push({ start: m.index + m[1].length + m[2].length, length: text.length, line: lineAt(m.index + m[1].length), kind: 'jsx' })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

/** Source text for `to`, escaped for the match's context. Throws if it can't be represented safely. */
export function encodeFor(match, to) {
  if (match.kind === 'jsx-rich') return to
  if (match.kind === 'template') return to.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
  if (match.kind === 'string') {
    if (match.quote !== '`') return escJs(to, match.quote)
    return to.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
  }
  if (/[{}<>]/.test(to) || to.includes('\n')) throw new Error('JSX text cannot contain { } < > or line breaks')
  return to
}

const RICH_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'a', 'br'])

function encodeRichHtml(html) {
  if (typeof html !== 'string' || html.length > 10000) throw new Error('rich text is too long')
  const tokens = html.match(/<[^>]*>|[^<]+/g) ?? []
  const stack = []
  let output = ''
  for (const token of tokens) {
    if (token.startsWith('</')) {
      const name = token.match(/^<\/([a-z]+)\s*>$/i)?.[1]?.toLowerCase()
      if (!name || stack.pop() !== name) throw new Error('unbalanced rich text markup')
      output += `</${name}>`
    } else if (token.startsWith('<')) {
      const match = token.match(/^<([a-z]+)([^>]*)>$/i)
      if (!match) throw new Error('unsupported rich text markup')
      const name = match[1].toLowerCase()
      const attrs = match[2]
      if (!RICH_TAGS.has(name)) throw new Error(`unsupported rich text element: ${name}`)
      if (name === 'a') {
        const href = attrs.match(/^\s+href\s*=\s*(?:"([^"]*)"|'([^']*)')\s*\/?$/i)
        if (!href) throw new Error('links must have one quoted href attribute')
        const value = href[1] ?? href[2]
        if (!/^(https?:|mailto:|tel:|\/|#)/i.test(value)) throw new Error('unsafe link URL')
        output += `<a href="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`
      } else {
        if (attrs.trim() && !(name === 'br' && attrs.trim() === '/')) throw new Error(`attributes are not allowed on ${name}`)
        output += `<${name}>`
      }
      if (name !== 'br') stack.push(name)
    } else {
      output += token.replace(/&(?!(?:#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);)/gi, '&amp;')
        .replace(/\{/g, '&#123;').replace(/\}/g, '&#125;')
    }
  }
  if (stack.length) throw new Error('unclosed rich text markup')
  return output
}

export function replaceAt(content, match, to) {
  if (match.kind === 'jsx-rich') to = encodeRichHtml(to)
  return content.slice(0, match.start) + encodeFor(match, to) + content.slice(match.start + match.length)
}
