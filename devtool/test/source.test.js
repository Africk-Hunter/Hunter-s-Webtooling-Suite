import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createServerContext } from '../src/server-context.js'
import { server } from '../tools/source/server.js'
import { sourceChain } from '../tools/source/client.js'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "webtool-source-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'src'))
  fs.mkdirSync(path.join(root, 'node_modules'))
  fs.writeFileSync(path.join(root, 'src', 'App.tsx'), 'x')
  fs.writeFileSync(path.join(root, 'node_modules', 'dep.js'), 'x')
  const calls = []
  const ctx = { ...createServerContext(root), editor: { open: (...args) => calls.push(args) } }
  return { root, ctx, calls }
}

test('opens project files at a position, absolute or relative', (t) => {
  const { root, ctx, calls } = fixture(t)
  const abs = path.join(root, 'src', 'App.tsx')
  assert.deepEqual(server.open({ file: abs, line: 3, column: 5 }, ctx), { file: 'src/App.tsx', line: 3, column: 5 })
  server.open({ file: 'src/App.tsx', line: 1 }, ctx)
  assert.deepEqual(calls[1], [abs, 1, 1])
})

test('refuses files outside the project, dependencies, missing files and odd input', (t) => {
  const { root, ctx, calls } = fixture(t)
  assert.throws(() => server.open({ file: path.join(root, '..', 'x.tsx'), line: 1 }, ctx), /outside project/)
  assert.throws(() => server.open({ file: 'node_modules/dep.js', line: 1 }, ctx), /dependency/)
  assert.throws(() => server.open({ file: 'src/Nope.tsx', line: 1 }, ctx), /not found/)
  assert.throws(() => server.open({ file: 'src/App.tsx" & calc "', line: 1 }, ctx), /invalid file/)
  assert.throws(() => server.open({ file: 'src/App.tsx', line: 0 }, ctx), /invalid position/)
  assert.throws(() => server.open({ file: 'src/App.tsx', line: '1' }, ctx), /invalid position/)
  assert.equal(calls.length, 0)
})

test('sourceChain reads React fiber debug sources', () => {
  const card = { type: function Card() {}, _debugSource: { fileName: '/p/src/App.tsx', lineNumber: 10, columnNumber: 4 }, return: null }
  const h2 = { type: 'h2', _debugSource: { fileName: '/p/src/Card.tsx', lineNumber: 3, columnNumber: 6 }, return: card }
  const chain = sourceChain({ __reactFiber$abc: h2 })
  assert.deepEqual(chain.map((c) => [c.name, c.line]), [['<h2>', 3], ['Card', 10]])
  assert.deepEqual(sourceChain({}), [])
})
