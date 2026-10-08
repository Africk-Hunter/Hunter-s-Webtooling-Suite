import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createServerContext } from '../src/server-context.js'
import { applyHead, parseHead, server } from '../tools/seo/server.js'
import { seoHints } from '../tools/seo/client.js'

const html = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>My &amp; Site</title>
    <meta content="Old description" name="description">
    <meta property='og:title' content='Old OG'>
  </head>
  <body></body>
</html>
`

test('parseHead reads title and meta tags regardless of attribute order or quotes', () => {
  const v = parseHead(html)
  assert.equal(v.title, 'My & Site')
  assert.equal(v.description, 'Old description')
  assert.equal(v['og:title'], 'Old OG')
  assert.equal(v['og:image'], '')
})

test('applyHead updates existing tags, inserts missing ones and escapes values', () => {
  const out = applyHead(html, { title: 'New <Title>', description: 'Say "hi" & bye', 'og:image': '/share.png', canonical: 'https://x.dev/' })
  const v = parseHead(out)
  assert.equal(v.title, 'New <Title>')
  assert.equal(v.description, 'Say "hi" & bye')
  assert.equal(v['og:image'], '/share.png')
  assert.equal(v.canonical, 'https://x.dev/')
  assert.match(out, /<title>New &lt;Title&gt;<\/title>/)
  assert.match(out, /<meta property="og:image" content="\/share\.png">\n {4}<link rel="canonical" href="https:\/\/x\.dev\/">\n {2}<\/head>/)
  assert.equal((out.match(/name="description"/g) ?? []).length, 1)
})

test('empty values remove the whole tag line; the title cannot be removed', () => {
  const out = applyHead(html, { description: '' })
  assert.doesNotMatch(out, /description/)
  assert.match(out, /<title>My &amp; Site<\/title>\n    <meta property='og:title'/)
  assert.throws(() => applyHead(html, { title: '' }), /title cannot be empty/)
})

test('applyHead rejects unknown fields, newlines, long values and a missing </head>', () => {
  assert.throws(() => applyHead(html, { 'og:evil': 'x' }), /unknown SEO field/)
  assert.throws(() => applyHead(html, { description: 'a\nb' }), /invalid value/)
  assert.throws(() => applyHead(html, { description: 'a'.repeat(501) }), /invalid value/)
  assert.throws(() => applyHead('<html></html>', { description: 'x' }), /closing <\/head>/)
})

test('an injected tag in a value stays inert text', () => {
  const out = applyHead(html, { description: '"><script>alert(1)</script>' })
  assert.doesNotMatch(out, /<script>/)
  assert.equal(parseHead(out).description, '"><script>alert(1)</script>')
})

test('apply writes index.html through history and can be undone', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webtool-seo-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'src'))
  fs.writeFileSync(path.join(root, 'index.html'), html)
  const ctx = createServerContext(root)
  assert.equal(server.read({}, ctx).title, 'My & Site')
  assert.equal(server.apply({ values: { title: 'Changed' } }, ctx).unchanged, false)
  assert.equal(server.apply({ values: { title: 'Changed' } }, ctx).unchanged, true)
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<title>Changed<\/title>/)
  ctx.history.undo(ctx.history.list()[0].id)
  assert.equal(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), html)
})

test('a literal > inside an attribute value does not truncate the tag', () => {
  const page = '<html><head>\n  <meta name="description" content="Fast > slow, always">\n  <title>T</title>\n</head></html>'
  assert.equal(parseHead(page).description, 'Fast > slow, always')
  const out = applyHead(page, { description: 'New text' })
  assert.match(out, /<meta name="description" content="New text">\n {2}<title>/)
  assert.doesNotMatch(out, /slow/)
  assert.equal(applyHead(page, { description: '' }), '<html><head>\n  <title>T</title>\n</head></html>')
})

test('comments, scripts, svg titles in the body and other lookalikes are ignored', () => {
  const page = `<html><head>
  <!-- <title>Old</title> <meta name="description" content="old"> -->
  <script>const t = '<title>Script</title>'; const m = '<meta name="description" content="js">'</script>
  <style>/* <title>Style</title> */</style>
  <title>Real</title>
  <META NAME="Description" CONTENT="Real description">
  <link rel="alternate canonical" href="https://x.dev/">
</head><body><svg><title>Chart</title></svg></body></html>`
  const v = parseHead(page)
  assert.equal(v.title, 'Real')
  assert.equal(v.description, 'Real description')
  assert.equal(v.canonical, 'https://x.dev/')
  const out = applyHead(page, { title: 'Changed' })
  assert.match(out, /<title>Changed<\/title>/)
  assert.match(out, /<!-- <title>Old<\/title>/)
  assert.match(out, /<svg><title>Chart<\/title><\/svg>/)
})

test('entities decode once, including numeric ones', () => {
  const v = parseHead('<head><title>Tom &amp;lt; &#39;Jerry&#39; &#x26; co</title></head>')
  assert.equal(v.title, "Tom &lt; 'Jerry' & co")
})

test('seoHints flags missing and over-long metadata', () => {
  assert.equal(seoHints({ title: 'Fine', description: 'd'.repeat(100), 'og:image': '/a.png' }).length, 0)
  assert.equal(seoHints({}).length, 3)
  assert.match(seoHints({ title: 't'.repeat(80), description: 'd'.repeat(100), 'og:image': 'x' })[0], /80 characters/)
})

test('a new title keeps $ sequences literally', () => {
  const html = applyHead('<html><head>\n</head></html>', { title: 'Cheap eats $$ and $&' })
  assert.match(html, /<title>Cheap eats \$\$ and \$&amp;<\/title>/)
})
