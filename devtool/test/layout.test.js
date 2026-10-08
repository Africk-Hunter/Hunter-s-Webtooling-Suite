import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createServerContext } from '../src/server-context.js'
import { elementEnd, offsetOf, reorderSiblings, server } from '../tools/layout/server.js'
import { reorderPlan } from '../tools/layout/client.js'

const tsx = `export const App = () => (
  <main>
    <Header title="a > b" onClick={() => { const s = '</Header>'; go(\`\${s}\`) }} />
    <section className="one">
      <p>One {count > 1 ? <b>many</b> : 'few'}</p>
    </section>
    <footer>Footer</footer>
  </main>
)
`

test('elementEnd handles self-closing tags, nesting, strings and expressions', () => {
  const header = tsx.indexOf('<Header')
  assert.equal(tsx.slice(header, elementEnd(tsx, header)).endsWith('} />'), true)
  const section = tsx.indexOf('<section')
  assert.equal(tsx.slice(section, elementEnd(tsx, section)).endsWith('</section>'), true)
  const main = tsx.indexOf('<main')
  assert.equal(tsx.slice(main, elementEnd(tsx, main)).endsWith('</main>'), true)
})

test('elementEnd reports malformed markup', () => {
  assert.throws(() => elementEnd('<div><span></div>', 0), /mismatched/)
  assert.throws(() => elementEnd('<div>', 0), /never closed/)
})

test('offsetOf accepts 1-based and 0-based columns', () => {
  const src = 'a\n  <p>x</p>\n'
  assert.equal(offsetOf(src, 2, 3), 4)
  assert.equal(offsetOf(src, 2, 2), 4)
  assert.throws(() => offsetOf(src, 2, 9), /no JSX element/)
})

test('reorderSiblings moves an element and preserves surrounding whitespace', () => {
  const positions = [
    { line: 3, column: 5 },
    { line: 4, column: 5 },
    { line: 7, column: 5 },
  ]
  const out = reorderSiblings(tsx, positions, 2, 0)
  const lines = out.split('\n')
  assert.match(lines[2], /^    <footer>Footer<\/footer>$/)
  assert.match(lines[3], /^    <Header/)
  assert.ok(out.includes('<section className="one">'))
  assert.equal(out.length, tsx.length)
  assert.equal(reorderSiblings(tsx, positions, 1, 1), tsx)
})

test('reorderSiblings refuses non-adjacent elements and bad input', () => {
  const withText = '<div>\n  <a>1</a>\n  text\n  <b>2</b>\n</div>\n'
  assert.throws(() => reorderSiblings(withText, [{ line: 2, column: 3 }, { line: 4, column: 3 }], 0, 1), /not adjacent/)
  assert.throws(() => reorderSiblings(withText, [{ line: 2, column: 3 }], 0, 0), /at least two/)
  assert.throws(() => reorderSiblings(withText, [{ line: 2, column: 3 }, { line: 4, column: 3 }], 0, 5), /out of range/)
  assert.throws(() => reorderSiblings(withText, [{ line: 4, column: 3 }, { line: 2, column: 3 }], 0, 1), /source order/)
})

test('move writes through history and can be undone; non-JSX files are refused', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webtool-layout-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'src'))
  fs.writeFileSync(path.join(root, 'src', 'App.tsx'), tsx)
  const ctx = createServerContext(root)
  const payload = { file: 'App.tsx', positions: [{ line: 4, column: 5 }, { line: 7, column: 5 }], from: 1, to: 0 }
  assert.equal(server.move(payload, ctx).unchanged, false)
  assert.ok(fs.readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8').indexOf('<footer>') < fs.readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8').indexOf('<section'))
  ctx.history.undo(ctx.history.list()[0].id)
  assert.equal(fs.readFileSync(path.join(root, 'src', 'App.tsx'), 'utf8'), tsx)
  assert.throws(() => server.move({ ...payload, file: 'x.ts' }, ctx), /only .tsx/)
  assert.throws(() => server.move({ ...payload, file: '../../etc/x.tsx' }, ctx), /outside/)
})

test('reorderPlan rejects looped, mixed-file and single children', () => {
  const p = (line, column, fileName = '/a.tsx') => ({ fileName, line, column })
  assert.equal(reorderPlan([p(1, 1)]).ok, false)
  assert.match(reorderPlan([p(1, 1), null]).reason, /no source info/)
  assert.match(reorderPlan([p(1, 1), p(1, 1)]).reason, /loop/)
  assert.match(reorderPlan([p(1, 1), p(2, 1, '/b.tsx')]).reason, /different files/)
  assert.equal(reorderPlan([p(1, 1), p(2, 1)]).ok, true)
})

test('apostrophes and quotes in JSX text inside expressions do not confuse the scanner', () => {
  const src = [
    'const A = () => (',
    '  <ul>',
    "    <li>{ok && <b>Don't</b>}</li>",
    '    <li>two</li>',
    '    <li>{items.map((x) => <i key={x}>"{x}" isn\'t</i>)}</li>',
    '    <li>{a < b ? <>it\'s</> : null}</li>',
    '  </ul>',
    ')',
    '',
  ].join('\n')
  const lines = src.split('\n')
  const at = (n) => ({ line: n, column: lines[n - 1].indexOf('<') + 1 })
  const out = reorderSiblings(src, [at(3), at(4), at(5), at(6)], 0, 3)
  const order = out.split('\n').slice(2, 6).map((l) => l.trim().slice(0, 12))
  assert.deepEqual(order, ['<li>two</li>', '<li>{items.m', '<li>{a < b ?', '<li>{ok && <'])
  assert.equal(out.length, src.length)
})
