import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createServerContext } from '../src/server-context.js'

function fixture(t) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'webtool-safety-'))
  const root = path.join(parent, 'site')
  fs.mkdirSync(path.join(root, 'src'), { recursive: true })
  fs.writeFileSync(path.join(root, 'src', 'index.css'), '.card { color: red; }\n')
  fs.writeFileSync(path.join(root, 'index.html'), '<html><head></head></html>\n')
  fs.writeFileSync(path.join(parent, 'secret.txt'), 'secret')
  // sibling directory sharing the project root's name as a prefix
  fs.mkdirSync(path.join(parent, 'site-evil'))
  fs.writeFileSync(path.join(parent, 'site-evil', 'x.txt'), 'x')
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }))
  return { parent, root, cssFile: path.join(root, 'src', 'index.css'), ctx: createServerContext(root) }
}

test('write rejects files outside the project root, including prefix-sibling dirs', (t) => {
  const { parent, ctx } = fixture(t)
  assert.throws(() => ctx.write(path.join(parent, 'secret.txt'), 'pwned'), /outside project/)
  assert.throws(() => ctx.write(path.join(parent, 'site-evil', 'x.txt'), 'pwned'), /outside project/)
  assert.equal(fs.readFileSync(path.join(parent, 'secret.txt'), 'utf8'), 'secret')
})

test('CSS declarations with injection characters or bad properties are rejected', (t) => {
  const { cssFile, ctx } = fixture(t)
  const before = fs.readFileSync(cssFile, 'utf8')
  for (const decls of [
    { color: 'red; } body { display: none' },
    { color: 'red}' },
    { color: '{' },
    { 'color: red; x': 'y' },
    { 'Color': 'red' },
    { color: 5 },
  ]) {
    assert.throws(() => ctx.css.setDeclarations('.card', decls, { tool: 'test' }), /rejected declaration/)
  }
  assert.equal(fs.readFileSync(cssFile, 'utf8'), before)
})

test('invalid selectors are rejected before any write', (t) => {
  const { cssFile, ctx } = fixture(t)
  const before = fs.readFileSync(cssFile, 'utf8')
  for (const selector of ['', '   ', '.a { color: red } .b', '.a {}', 'x'.repeat(501), 42]) {
    assert.throws(() => ctx.css.setDeclarations(selector, { color: 'red' }, { tool: 'test' }), /invalid selector/)
  }
  assert.equal(fs.readFileSync(cssFile, 'utf8'), before)
})

test('empty declaration sets are rejected', (t) => {
  const { ctx } = fixture(t)
  assert.throws(() => ctx.css.setDeclarations('.card', {}, { tool: 'test' }), /no CSS declarations/)
  assert.throws(() => ctx.css.setDeclarations('.card', null, { tool: 'test' }), /no CSS declarations/)
})

test('undo refuses to clobber a manual change and succeeds after restoring', (t) => {
  const { cssFile, ctx } = fixture(t)
  const entry = ctx.css.setDeclarations('.card', { color: 'green' }, { tool: 'test' })
  const id = entry?.id ?? ctx.history.list()[0].id
  const edited = fs.readFileSync(cssFile, 'utf8')
  fs.writeFileSync(cssFile, edited + '/* manual */\n')
  assert.throws(() => ctx.history.undo(id), /changed since/)
  assert.match(fs.readFileSync(cssFile, 'utf8'), /manual/)
  fs.writeFileSync(cssFile, edited)
  ctx.history.undo(id)
  assert.match(fs.readFileSync(cssFile, 'utf8'), /color: red/)
  assert.throws(() => ctx.history.undo(id), /already undone/)
})

test('values that would leave a stylesheet unparseable are rejected before any write', (t) => {
  const { cssFile, ctx } = fixture(t)
  const before = fs.readFileSync(cssFile, 'utf8')
  for (const color of ['red /*', 'red */', 'url(x', 'red)', '"open', "'open", 'red\\']) {
    assert.throws(() => ctx.css.setDeclarations('.card', { color }, { tool: 'test' }), /rejected declaration/, color)
  }
  assert.throws(() => ctx.css.setCustomProperties({ '--color-a': 'red /*' }), /invalid token value/)
  assert.throws(() => ctx.css.setTypographyTokens({ '--font-body': 'Inter, "Open' }), /invalid token value/)
  assert.equal(fs.readFileSync(cssFile, 'utf8'), before)
  ctx.css.setDeclarations('.card', { 'background-image': 'url("a b.png")', color: 'rgb(0 0 0 / 50%)' }, { tool: 'test' })
})

test('write refuses content that does not parse as CSS, and later edits keep working', (t) => {
  const { cssFile, root, ctx } = fixture(t)
  const before = fs.readFileSync(cssFile, 'utf8')
  assert.throws(() => ctx.write(cssFile, '.a { color: red /*; }\n', { tool: 'test' }), /invalid CSS/)
  assert.equal(fs.readFileSync(cssFile, 'utf8'), before)
  ctx.write(path.join(root, 'index.html'), '<html></html>\n', { tool: 'test' })
  ctx.css.setDeclarations('.card', { color: 'green' }, { tool: 'test' })
})

test('a stylesheet that does not parse is skipped, not fatal', (t) => {
  const { root, ctx } = fixture(t)
  fs.writeFileSync(path.join(root, 'src', 'broken.css'), '.x { color: red /*\n')
  const result = ctx.css.setDeclarations('.card', { color: 'green' }, { tool: 'test' })
  assert.equal(result.file, 'index.css')
})

test('rules inside @layer and @supports are edited in place, not duplicated', (t) => {
  const { root, ctx } = fixture(t)
  const layered = path.join(root, 'src', 'layers.css')
  fs.writeFileSync(layered, '@layer base {\n  .c { color: red }\n}\n@supports (display: grid) {\n  .g { display: block }\n}\n')
  const first = ctx.css.setDeclarations('.c', { color: 'blue' }, { tool: 'test' })
  assert.deepEqual([first.file, first.created], ['layers.css', false])
  const second = ctx.css.setDeclarations('.g', { display: 'grid' }, { tool: 'test' })
  assert.deepEqual([second.file, second.created], ['layers.css', false])
  const text = fs.readFileSync(layered, 'utf8')
  assert.match(text, /\.c \{ color: red;? ?\}?|color: blue/)
  assert.equal((text.match(/\.c\s*\{/g) ?? []).length, 1)
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'src', 'index.css'), 'utf8'), /\.c\b/)
})

test('selector lists match across whitespace and @media rules inside @layer are found', (t) => {
  const { root, ctx } = fixture(t)
  const file = path.join(root, 'src', 'm.css')
  fs.writeFileSync(file, 'h1,\nh2 { margin: 0 }\n@layer ui {\n  @media (min-width: 600px) {\n    .m { color: red }\n  }\n}\n')
  assert.equal(ctx.css.setDeclarations('h1, h2', { margin: '1rem' }, { tool: 'test' }).created, false)
  assert.equal(ctx.css.setDeclarations('.m', { color: 'blue' }, { tool: 'test', media: '(min-width: 600px)' }).created, false)
})

test('a class found in no stylesheet is reported, and a known class is not', (t) => {
  const { ctx } = fixture(t)
  const hashed = ctx.css.setDeclarations('.Button_x1y2z', { color: 'blue' }, { tool: 'test' })
  assert.equal(hashed.created, true)
  assert.match(hashed.warning, /\.Button_x1y2z/)
  const known = ctx.css.setDeclarations('.card .title', { color: 'blue' }, { tool: 'test' })
  assert.equal(known.created, true)
  assert.match(known.warning, /\.title/)
  assert.doesNotMatch(known.warning, /\.card/)
  assert.equal(ctx.css.setDeclarations('.card', { color: 'green' }, { tool: 'test' }).warning, undefined)
})

test('history entries persist across context restarts', (t) => {
  const { root, ctx } = fixture(t)
  ctx.css.setDeclarations('.card', { color: 'green' }, { tool: 'test' })
  const reloaded = createServerContext(root)
  assert.equal(reloaded.history.list().length, 1)
})

test('history entries with traversal ids or files are ignored on load', (t) => {
  const { root } = fixture(t)
  const dir = path.join(root, '.webtool', 'history')
  fs.mkdirSync(dir, { recursive: true })
  const base = { ts: 1, tool: 'x', label: 'x', before: 'a', after: 'b', undone: false }
  fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify({ ...base, id: '../../package', file: 'index.html' }))
  fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify({ ...base, id: 'b1', file: 'src/../package.json' }))
  fs.writeFileSync(path.join(dir, 'c.json'), JSON.stringify({ ...base, id: 'c1', file: 'package.json' }))
  fs.writeFileSync(path.join(dir, 'd.json'), JSON.stringify({ ...base, id: 'd1', file: 'index.html' }))
  assert.deepEqual(createServerContext(root).history.list().map((e) => e.id), ['d1'])
})

test('writes through a symlink that leaves the project are refused', (t) => {
  const { parent, root, ctx } = fixture(t)
  fs.mkdirSync(path.join(parent, 'other'))
  fs.writeFileSync(path.join(parent, 'other', 'x.tsx'), 'x')
  try { fs.symlinkSync(path.join(parent, 'other'), path.join(root, 'src', 'shared'), 'junction') } catch { return t.skip('cannot create symlinks here') }
  assert.throws(() => ctx.source.abs('shared/x.tsx'), /outside src/)
  assert.throws(() => ctx.write(path.join(root, 'src', 'shared', 'x.tsx'), 'pwned'), /outside project/)
  assert.equal(fs.readFileSync(path.join(parent, 'other', 'x.tsx'), 'utf8'), 'x')
})
