import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { resolveOptions } from '../src/options.js'
import { createServerContext } from '../src/server-context.js'

test('defaults keep every built-in tool and src/', () => {
  const { tools, srcDir } = resolveOptions()
  assert.equal(srcDir, 'src')
  assert.ok(tools.some((t) => t.id === 'resize'))
})

test('disable removes built-ins and custom tools are appended', () => {
  const { tools } = resolveOptions({ disable: ['devconsole'], tools: [{ id: 'mine', client: '/x.js' }] })
  assert.ok(!tools.some((t) => t.id === 'devconsole'))
  assert.equal(tools.at(-1).id, 'mine')
})

test('bad options fail with a clear message', () => {
  assert.throws(() => resolveOptions({ tool: [] }), /unknown option tool/)
  assert.throws(() => resolveOptions({ disable: ['nope'] }), /unknown built-in tool "nope"/)
  assert.throws(() => resolveOptions({ tools: [{ id: 'resize', client: '/x.js' }] }), /duplicate tool id/)
  assert.throws(() => resolveOptions({ tools: [{ id: 'a b', client: '/x.js' }] }), /string id/)
  assert.throws(() => resolveOptions({ tools: [{ id: 'ok' }] }), /client file path/)
  assert.throws(() => resolveOptions({ srcDir: '' }), /srcDir/)
})

test('a custom srcDir drives CSS discovery, writes and undo', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webtool-srcdir-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'app', 'styles'), { recursive: true })
  const css = path.join(root, 'app', 'styles', 'main.css')
  fs.writeFileSync(css, '.card { color: red; }\n')
  const ctx = createServerContext(root, { srcDir: 'app' })
  ctx.css.setDeclarations('.card', { color: 'green' }, { tool: 'test' })
  assert.match(fs.readFileSync(css, 'utf8'), /green/)
  ctx.history.undo(ctx.history.list()[0].id)
  assert.match(fs.readFileSync(css, 'utf8'), /red/)
})

test('srcDir cannot escape the project root', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webtool-srcdir-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  assert.throws(() => createServerContext(root, { srcDir: '..' }), /inside the project root/)
  assert.throws(() => createServerContext(root, { srcDir: '.' }), /inside the project root/)
})

test('allowRemote defaults to false and must be a boolean', () => {
  assert.equal(resolveOptions().allowRemote, false)
  assert.equal(resolveOptions({ allowRemote: true }).allowRemote, true)
  assert.throws(() => resolveOptions({ allowRemote: 'yes' }), /allowRemote/)
})
