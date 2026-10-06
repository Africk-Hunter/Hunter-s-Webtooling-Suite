import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createServerContext } from '../src/server-context.js'

const initialCss = `:root { --color-primary: #123456; }
.card { color: red; }
@media (max-width: 767px) {
  .card { color: blue; }
}
@media (min-width: 768px) {
  .card { color: black; }
}
`

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webtool-context-'))
  const src = path.join(root, 'src')
  fs.mkdirSync(src)
  const cssFile = path.join(src, 'index.css')
  fs.writeFileSync(cssFile, initialCss)
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return { cssFile, ctx: createServerContext(root) }
}

test('base CSS writes do not alter matching rules inside media queries', (t) => {
  const { cssFile, ctx } = fixture(t)
  ctx.css.setDeclarations('.card', { color: 'green' }, { tool: 'test' })
  const css = fs.readFileSync(cssFile, 'utf8')
  assert.match(css, /\.card \{\s*color: green;/)
  assert.match(css, /@media \(max-width: 767px\) \{\s*\.card \{ color: blue;/)
})

test('media writes update only the selected breakpoint and are undoable', (t) => {
  const { cssFile, ctx } = fixture(t)
  ctx.css.setDeclarations('.card', { color: 'orange' }, {
    tool: 'test',
    media: '(max-width: 767px)',
  })
  const edited = fs.readFileSync(cssFile, 'utf8')
  assert.match(edited, /@media \(max-width: 767px\) \{\s*\.card \{\s*color: orange;/)
  assert.match(edited, /@media \(min-width: 768px\) \{\s*\.card \{ color: black;/)
  const [entry] = ctx.history.list()
  assert.equal(entry.tool, 'test')
  ctx.history.undo(entry.id)
  assert.equal(fs.readFileSync(cssFile, 'utf8'), initialCss)
})

test('media writes create a new exact media block when needed', (t) => {
  const { cssFile, ctx } = fixture(t)
  ctx.css.setDeclarations('.card', { padding: '1rem' }, {
    tool: 'test',
    media: '(max-width: 500px)',
  })
  assert.match(
    fs.readFileSync(cssFile, 'utf8'),
    /@media \(max-width: 500px\)\s*\{\s*\.card \{\s*padding: 1rem;/,
  )
})

test('color token writes are validated and recorded for undo', (t) => {
  const { cssFile, ctx } = fixture(t)
  ctx.css.setCustomProperties({ '--color-primary': '#abcdef' }, { tool: 'colors' })
  assert.match(fs.readFileSync(cssFile, 'utf8'), /--color-primary: #abcdef/)
  const [entry] = ctx.history.list()
  assert.equal(entry.tool, 'colors')
  ctx.history.undo(entry.id)
  assert.equal(fs.readFileSync(cssFile, 'utf8'), initialCss)
})

test('invalid token batches do not partially write CSS', (t) => {
  const { cssFile, ctx } = fixture(t)
  assert.throws(() => ctx.css.setCustomProperties({
    '--color-primary': '#abcdef',
    '--color-missing': '#ffffff',
  }), /not found/)
  assert.equal(fs.readFileSync(cssFile, 'utf8'), initialCss)
})

test('invalid media query syntax is rejected', (t) => {
  const { ctx } = fixture(t)
  assert.throws(() => ctx.css.setDeclarations('.card', { color: 'red' }, {
    media: '(max-width: 767px); body { color: black',
  }), /invalid media query/)
})
