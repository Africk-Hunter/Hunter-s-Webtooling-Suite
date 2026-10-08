import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createServerContext } from '../src/server-context.js'
import { findImageRefs, server } from '../tools/images/server.js'
import { imageWarnings } from '../tools/images/client.js'

function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webtool-images-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), content)
  }
  return { root, ctx: createServerContext(root) }
}

const png = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64')

test('findImageRefs matches public paths, relative imports and ignores other strings', () => {
  const code = "const a = '/images/hero.jpg'\nimport logo from './assets/logo.svg'\nconst b = 'hero.jpg.txt'\nconst c = '/images/other.png'\n"
  assert.deepEqual(findImageRefs(code, 'http://localhost:5173/images/hero.jpg').map((r) => r.value), ['/images/hero.jpg'])
  assert.deepEqual(findImageRefs(code, '/src/assets/logo.svg?t=123').map((r) => r.value), ['./assets/logo.svg'])
})

test('inspect reports size and source references', (t) => {
  const { ctx } = fixture(t, { 'src/data.ts': "export const hero = '/images/hero.jpg'\n", 'public/images/hero.jpg': 'x'.repeat(2048) })
  const result = server.inspect({ src: 'http://localhost:5173/images/hero.jpg' }, ctx)
  assert.equal(result.bytes, 2048)
  assert.equal(result.refs.length, 1)
  assert.equal(result.refs[0].file, 'data.ts')
})

test('swap saves a public asset, rewrites the literal and is undoable', (t) => {
  const { root, ctx } = fixture(t, { 'src/data.ts': "export const hero = '/images/hero.jpg'\n" })
  const [ref] = server.inspect({ src: '/images/hero.jpg' }, ctx).refs
  const result = server.swap({ src: '/images/hero.jpg', name: 'new.png', data: png, file: ref.file, line: ref.line, start: ref.start }, ctx)
  assert.equal(result.value, '/images/new.png')
  assert.ok(fs.existsSync(path.join(root, 'public/images/new.png')))
  assert.equal(fs.readFileSync(path.join(root, 'src/data.ts'), 'utf8'), "export const hero = '/images/new.png'\n")
  ctx.history.undo(ctx.history.list()[0].id)
  assert.match(fs.readFileSync(path.join(root, 'src/data.ts'), 'utf8'), /hero\.jpg/)
})

test('swap for a relative import saves under src/assets with a relative path', (t) => {
  const { root, ctx } = fixture(t, { 'src/components/Nav.tsx': "import logo from '../assets/logo.svg'\n" })
  const [ref] = server.inspect({ src: '/src/assets/logo.svg' }, ctx).refs
  const result = server.swap({ src: '/src/assets/logo.svg', name: 'brand.png', data: png, file: ref.file, line: ref.line, start: ref.start }, ctx)
  assert.equal(result.value, '../assets/brand.png')
  assert.ok(fs.existsSync(path.join(root, 'src/assets/brand.png')))
})

test('swap rejects bad names, empty data, stale references and overwrites', (t) => {
  const { ctx } = fixture(t, { 'src/data.ts': "export const hero = '/images/hero.jpg'\n", 'public/images/taken.png': 'x' })
  const [ref] = server.inspect({ src: '/images/hero.jpg' }, ctx).refs
  const base = { src: '/images/hero.jpg', name: 'ok.png', data: png, file: ref.file, line: ref.line, start: ref.start }
  assert.throws(() => server.swap({ ...base, name: '../evil.png' }, ctx), /unsupported file name/)
  assert.throws(() => server.swap({ ...base, name: 'script.js' }, ctx), /unsupported file name/)
  assert.throws(() => server.swap({ ...base, data: '' }, ctx), /no file data/)
  assert.throws(() => server.swap({ ...base, start: ref.start + 1 }, ctx), /moved/)
  assert.throws(() => server.swap({ ...base, name: 'taken.png' }, ctx), /already exists/)
})

test('assets.add only writes under public/ or src/', (t) => {
  const { ctx } = fixture(t, { 'src/a.ts': '' })
  assert.throws(() => ctx.assets.add('index.html', Buffer.from('x')), /public\/ or the source folder/)
  assert.throws(() => ctx.assets.add('../escape.png', Buffer.from('x')), /outside project/)
})

test('imageWarnings flags large, oversized, blurry and unsized images', () => {
  const base = { natural: { w: 800, h: 600 }, rendered: { w: 800, h: 600 } }
  assert.deepEqual(imageWarnings(base), [])
  assert.match(imageWarnings({ ...base, bytes: 900 * 1024 })[0], /Large file/)
  assert.match(imageWarnings({ natural: { w: 4000, h: 3000 }, rendered: { w: 400, h: 300 } })[0], /Oversized/)
  assert.match(imageWarnings({ natural: { w: 200, h: 150 }, rendered: { w: 400, h: 300 }, dpr: 2 })[0], /Low resolution/)
  assert.match(imageWarnings({ ...base, hasDimensions: false })[0], /width\/height/)
  assert.deepEqual(imageWarnings({ natural: { w: 4000, h: 3000 }, rendered: { w: 400, h: 300 }, svg: true }), [])
})
