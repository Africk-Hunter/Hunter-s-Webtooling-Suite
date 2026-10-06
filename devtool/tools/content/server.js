import fs from 'node:fs'
import { findText, replaceAt } from '../../src/source-text.js'

function occurrences(text, ctx) {
  const out = []
  for (const abs of ctx.source.files(['.ts', '.tsx'])) {
    const content = fs.readFileSync(abs, 'utf8')
    const lines = content.split('\n')
    for (const m of findText(content, text, { jsx: abs.endsWith('.tsx') })) {
      out.push({ file: ctx.source.rel(abs), line: m.line, kind: m.kind, snippet: lines[m.line - 1].trim().slice(0, 100) })
    }
  }
  return out
}

export const server = {
  // payload: { text } -> where that exact text lives in source
  locate: ({ text }, ctx) => (typeof text === 'string' && text ? occurrences(text, ctx) : []),

  // payload: { text, to, file, line } — replaces the one occurrence at file:line
  replace({ text, to, file, line }, ctx) {
    if (typeof text !== 'string' || typeof to !== 'string' || !text || !to.trim()) throw new Error('bad payload')
    const known = occurrences(text, ctx).find((o) => o.file === file && o.line === line)
    if (!known) throw new Error('text no longer at that location; reselect the element')
    const abs = ctx.source.abs(file)
    const content = fs.readFileSync(abs, 'utf8')
    const match = findText(content, text, { jsx: abs.endsWith('.tsx') }).find((m) => m.line === line)
    ctx.write(abs, replaceAt(content, match, to.trim()), { tool: 'content', label: `text "${text.slice(0, 30)}" → "${to.trim().slice(0, 30)}"` })
    return { file, line }
  },
}
