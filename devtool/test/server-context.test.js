import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createServerContext } from '../src/server-context.js'
import { server as typographyServer } from '../tools/typography/server.js'

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

test('typography tokens can be updated or created and are undoable', (t) => {
  const { cssFile, ctx } = fixture(t)
  ctx.css.setTypographyTokens({
    '--font-heading': '"Example Sans", sans-serif',
    '--size-display': 'clamp(2rem, 1.5rem + 2vw, 4rem)',
  }, { tool: 'typography-tokens' })
  const edited = fs.readFileSync(cssFile, 'utf8')
  assert.match(edited, /--font-heading: "Example Sans", sans-serif/)
  assert.match(edited, /--size-display: clamp\(2rem, 1\.5rem \+ 2vw, 4rem\)/)
  const [entry] = ctx.history.list()
  ctx.history.undo(entry.id)
  assert.equal(fs.readFileSync(cssFile, 'utf8'), initialCss)
})

test('project-root index.html writes participate in history undo and redo', (t) => {
  const { ctx } = fixture(t)
  const htmlFile = path.join(ctx.root, 'index.html')
  fs.writeFileSync(htmlFile, '<html><head></head><body></body></html>')
  ctx.write(htmlFile, '<html><head><link rel="stylesheet"></head><body></body></html>', {
    tool: 'typography',
    label: 'load Google Font',
  })
  const [entry] = ctx.history.list()
  assert.equal(entry.file, 'index.html')
  ctx.history.undo(entry.id)
  assert.equal(fs.readFileSync(htmlFile, 'utf8'), '<html><head></head><body></body></html>')
  ctx.history.redo(entry.id)
  assert.match(fs.readFileSync(htmlFile, 'utf8'), /rel="stylesheet"/)
})

test('Google Font links are safely added once and recorded for undo', (t) => {
  const { ctx } = fixture(t)
  const htmlFile = path.join(ctx.root, 'index.html')
  fs.writeFileSync(htmlFile, '<html><head></head><body></body></html>')
  const first = typographyServer.applyGoogleFont({ family: 'DM Sans', selector: '.card' }, ctx)
  assert.equal(first.file, 'index.html')
  const html = fs.readFileSync(htmlFile, 'utf8')
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=DM\+Sans/)
  const history = ctx.history.list()
  const htmlEntry = history.find((entry) => entry.file === 'index.html')
  const cssEntry = history.find((entry) => entry.file === 'src/index.css')
  assert.ok(htmlEntry)
  assert.ok(cssEntry)
  assert.equal(typographyServer.applyGoogleFont({ family: 'DM Sans', selector: '.card' }, ctx).unchanged, true)
  assert.equal(ctx.history.list().length, 2)
  ctx.history.undo(htmlEntry.id)
  ctx.history.undo(cssEntry.id)
  assert.equal(fs.readFileSync(htmlFile, 'utf8'), '<html><head></head><body></body></html>')
})

test('typography token discovery separates family and size tokens', (t) => {
  const { cssFile, ctx } = fixture(t)
  fs.writeFileSync(cssFile, ':root { --font-body: "DM Sans", sans-serif; --font-size-h1: 4rem; --size-copy: 1rem; }')
  assert.deepEqual(typographyServer.tokens({}, ctx), {
    fonts: [{ name: '--font-body', value: '"DM Sans", sans-serif' }],
    sizes: [
      { name: '--font-size-h1', value: '4rem' },
      { name: '--size-copy', value: '1rem' },
    ],
  })
})
