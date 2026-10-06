// Find / replace a rendered text string inside TS/TSX source (string literals and JSX text).
// No AST: matches the exact rendered text, so it works for config strings used via {expr} too.

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const escJs = (s, q) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').split(q).join('\\' + q)

/** @returns {{start:number,length:number,line:number,kind:'string'|'jsx',quote?:string}[]} */
export function findText(content, text, { jsx = true } = {}) {
  const out = []
  const lineAt = (i) => content.slice(0, i).split('\n').length
  for (const q of ["'", '"', '`']) {
    const src = escJs(text, q)
    const re = new RegExp(escRe(q + src) + '(?=' + escRe(q) + ')', 'g')
    for (const m of content.matchAll(re)) out.push({ start: m.index + 1, length: src.length, line: lineAt(m.index), kind: 'string', quote: q })
  }
  if (jsx) {
    const re = new RegExp('(>|\\n)([ \\t]*)(' + escRe(text) + ')[ \\t]*(?=<|\\n|\\{)', 'g')
    for (const m of content.matchAll(re)) {
      out.push({ start: m.index + m[1].length + m[2].length, length: text.length, line: lineAt(m.index + m[1].length), kind: 'jsx' })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

/** Source text for `to`, escaped for the match's context. Throws if it can't be represented safely. */
export function encodeFor(match, to) {
  if (match.kind === 'string') {
    if (match.quote !== '`') return escJs(to, match.quote)
    return to.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
  }
  if (/[{}<>]/.test(to) || to.includes('\n')) throw new Error('JSX text cannot contain { } < > or line breaks')
  return to
}

export function replaceAt(content, match, to) {
  return content.slice(0, match.start) + encodeFor(match, to) + content.slice(match.start + match.length)
}
