import fs from 'node:fs'
import { findText, replaceAt } from '../../src/source-text.js'

function occurrences(text, ctx) {
  const out = []
  for (const abs of ctx.source.files(['.ts', '.tsx'])) {
    const content = fs.readFileSync(abs, 'utf8')
    const lines = content.split('\n')
    for (const m of findText(content, text, { jsx: abs.endsWith('.tsx') })) {
      out.push({
        file: ctx.source.rel(abs),
        line: m.line,
        start: m.start,
        length: m.length,
        kind: m.kind,
        snippet: lines[m.line - 1].trim().slice(0, 100),
      })
    }
  }
  return out
}

export const server = {
  // payload: { text } -> where that exact text lives in source
  locate: ({ text }, ctx) => (typeof text === 'string' && text
    ? [...new Map(occurrences(text, ctx).map((match) =>
      [`${match.file}:${match.line}:${match.start}:${match.length}`, match])).values()]
    : []),

  // payload: { text, to?, html?, file, line } — replaces one occurrence at file:line
  replace({ text, to, html, file, line, start }, ctx) {
    if (typeof text !== 'string' || !text || typeof file !== 'string'
      || !Number.isInteger(line) || !Number.isInteger(start)) throw new Error('bad payload')
    const known = occurrences(text, ctx).find((o) => o.file === file && o.line === line && o.start === start)
    if (!known) throw new Error('text no longer at that location; reselect the element')
    if (known.kind === 'jsx-rich' && typeof html !== 'string') throw new Error('rich text content is required')
    if (known.kind !== 'jsx-rich' && (typeof to !== 'string' || !to.trim())) throw new Error('replacement text is required')
    const abs = ctx.source.abs(file)
    const content = fs.readFileSync(abs, 'utf8')
    const match = findText(content, text, { jsx: abs.endsWith('.tsx') }).find((m) =>
      m.line === line && m.kind === known.kind && m.start === known.start)
    if (!match) throw new Error('text no longer at that location; reselect the element')
    const replacement = known.kind === 'jsx-rich' ? html : to.trim()
    ctx.write(abs, replaceAt(content, match, replacement), {
      tool: 'content',
      label: `text "${text.slice(0, 30)}" → "${replacement.slice(0, 30)}"`,
    })
    return { file, line }
  },
}
