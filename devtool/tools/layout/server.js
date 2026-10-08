// Layout tool server: reorders sibling JSX elements in source.
// A tiny JSX scanner finds each element's exact extent (no parser dependency); reordering only
// proceeds when the elements are adjacent siblings separated by whitespace.

/** Whether the `<` at `i`, inside a JS expression, opens a JSX element (not a comparison or a type argument). */
function startsJsx(src, i) {
  if (!/[A-Za-z>]/.test(src[i + 1] ?? '')) return false
  let j = i - 1
  while (j >= 0 && /\s/.test(src[j])) j--
  if (j < 0) return true
  if ('({[,?:&|=!>;'.includes(src[j])) return true
  return /(?:^|[^\w$])return$/.test(src.slice(Math.max(0, j - 6), j + 1))
}

/** Skips a balanced `{ ... }` JSX expression starting at `i` (content[i] === '{'); returns the index after `}`. */
function skipBraces(src, i) {
  let depth = 0
  for (; i < src.length; i++) {
    const ch = src[i]
    if (ch === '<' && startsJsx(src, i)) {
      i = elementEnd(src, i) - 1 // JSX text inside an expression may hold quotes and apostrophes
    } else if (ch === '"' || ch === "'") {
      for (i++; i < src.length && src[i] !== ch; i++) if (src[i] === '\\') i++
    } else if (ch === '`') {
      for (i++; i < src.length && src[i] !== '`'; i++) {
        if (src[i] === '\\') i++
        else if (src[i] === '$' && src[i + 1] === '{') i = skipBraces(src, i + 1) - 1
      }
    } else if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
    } else if (ch === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2)
      if (i < 0) throw new Error('unterminated comment')
      i++
    } else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return i + 1
  }
  throw new Error('unbalanced braces')
}

const NAME = /[\w.:$-]*/y

/** Returns the index just after the JSX element that starts with `<` at `start`. */
export function elementEnd(src, start) {
  if (src[start] !== '<') throw new Error('not at an element')
  let i = start + 1
  NAME.lastIndex = i
  const name = NAME.exec(src)[0]
  i += name.length
  // opening tag attributes
  for (; i < src.length; i++) {
    const ch = src[i]
    if (ch === '"' || ch === "'") { i = src.indexOf(ch, i + 1); if (i < 0) throw new Error('unterminated string') }
    else if (ch === '{') i = skipBraces(src, i) - 1
    else if (ch === '/' && src[i + 1] === '>') return i + 2
    else if (ch === '>') { i++; break }
  }
  // children
  while (i < src.length) {
    const ch = src[i]
    if (ch === '{') i = skipBraces(src, i)
    else if (ch === '<' && src[i + 1] === '/') {
      const close = src.indexOf('>', i)
      if (close < 0) throw new Error('unterminated closing tag')
      if (src.slice(i + 2, close).trim() !== name) throw new Error(`mismatched closing tag for <${name}>`)
      return close + 1
    } else if (ch === '<') i = elementEnd(src, i)
    else i++
  }
  throw new Error(`<${name}> is never closed`)
}

/** Offset of the `<` for a React debug position (1-based line; column is 1-based, falling back to 0-based). */
export function offsetOf(src, line, column) {
  const lines = src.split('\n')
  if (!Number.isInteger(line) || line < 1 || line > lines.length) throw new Error('line out of range')
  let base = 0
  for (let n = 0; n < line - 1; n++) base += lines[n].length + 1
  for (const col of [column - 1, column]) {
    if (col >= 0 && src[base + col] === '<') return base + col
  }
  throw new Error(`no JSX element at ${line}:${column}`)
}

/**
 * Reorders the given sibling elements. `positions` are the siblings' source positions in their CURRENT
 * order; the one at `from` moves to index `to`. Gaps between siblings must be whitespace only.
 */
export function reorderSiblings(src, positions, from, to) {
  if (!Array.isArray(positions) || positions.length < 2 || positions.length > 200) throw new Error('need at least two siblings')
  if (![from, to].every((n) => Number.isInteger(n) && n >= 0 && n < positions.length)) throw new Error('index out of range')
  if (from === to) return src
  const ranges = positions.map(({ line, column }) => {
    const start = offsetOf(src, line, column)
    return { start, end: elementEnd(src, start) }
  })
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start <= ranges[i - 1].start) throw new Error('siblings are not in source order')
    if (src.slice(ranges[i - 1].end, ranges[i].start).trim()) {
      throw new Error('these elements are not adjacent in source (text or expressions sit between them)')
    }
  }
  const blocks = ranges.map((r) => src.slice(r.start, r.end))
  const [moved] = blocks.splice(from, 1)
  blocks.splice(to, 0, moved)
  let out = src.slice(0, ranges[0].start)
  blocks.forEach((block, i) => {
    out += block
    if (i < ranges.length - 1) out += src.slice(ranges[i].end, ranges[i + 1].start)
  })
  return out + src.slice(ranges.at(-1).end)
}

export const server = {
  // payload: { file, positions: [{line, column}], from, to }
  move({ file, positions, from, to }, ctx) {
    if (typeof file !== 'string' || !/\.(tsx|jsx)$/.test(file)) throw new Error('only .tsx/.jsx files can be reordered')
    if (!Array.isArray(positions) || positions.some((p) => !p || !Number.isInteger(p.line) || !Number.isInteger(p.column))) throw new Error('bad positions')
    const abs = ctx.source.abs(file)
    const before = ctx.fs.read(abs)
    const after = reorderSiblings(before, positions, from, to)
    if (after === before) return { file, unchanged: true }
    ctx.write(abs, after, { tool: 'layout', label: `reorder element ${from + 1} → ${to + 1} in ${file}` })
    return { file, unchanged: false }
  },
}
