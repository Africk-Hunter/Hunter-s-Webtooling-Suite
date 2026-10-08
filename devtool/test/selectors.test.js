import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'

function setup(html, css = '') {
  const dom = new JSDOM(`<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>`)
  const { window } = dom
  // jsdom lacks CSS.escape; the selector helpers rely on it and Node globals
  window.CSS ??= {}
  window.CSS.escape ??= (value) => String(value).replace(/[^\w-]/g, (ch) => `\${ch}`)
  globalThis.CSS = window.CSS
  globalThis.Node = window.Node
  return window.document
}

const { selectorFor, selectorCandidates } = await import('../src/client/selectors.js')

test('selectorFor returns a selector that matches exactly the element', () => {
  const doc = setup('<ul class="list"><li class="item">a</li><li class="item">b</li><li class="item">c</li></ul><p>x</p>')
  for (const el of doc.body.querySelectorAll('*')) {
    const sel = selectorFor(el)
    const found = doc.querySelectorAll(sel)
    assert.equal(found.length, 1, `${sel} should be unique`)
    assert.equal(found[0], el)
  }
})

test('selectorFor stops at an id and escapes unusual ids/classes', () => {
  const doc = setup('<div id="a:b"><span class="x.y">t</span></div>')
  assert.equal(selectorFor(doc.getElementById('a:b')), '#a\\:b')
  const span = doc.querySelector('span')
  assert.equal(doc.querySelector(selectorFor(span)), span)
})

test('selectorFor disambiguates identical siblings with nth-of-type', () => {
  const doc = setup('<div><p class="t">1</p><p class="t">2</p></div>')
  const second = doc.querySelectorAll('p')[1]
  assert.match(selectorFor(second), /nth-of-type\(2\)/)
})

test('selectorCandidates puts the unique path first and the tag scope last, without duplicates', () => {
  const doc = setup('<section class="hero"><h2 class="title">Hi</h2></section>')
  const list = selectorCandidates(doc.querySelector('h2'))
  assert.equal(list[0].label, 'This element only')
  assert.equal(list.at(-1).selector, 'h2')
  assert.equal(new Set(list.map((c) => c.selector)).size, list.length)
  assert.ok(list.some((c) => c.selector === '.title'))
  assert.ok(list.some((c) => c.selector === '.hero .title'))
})

test('existing matching rules are ranked by specificity, highest first', () => {
  const css = 'h2 { color: red } .title { color: blue } section .title.big { color: green } .other { color: pink }'
  const doc = setup('<section class="hero"><h2 class="title big">Hi</h2></section>', css)
  const rules = selectorCandidates(doc.querySelector('h2')).filter((c) => c.label.startsWith('CSS rule'))
  assert.deepEqual(rules.map((c) => c.selector), ['section .title.big', '.title'])
})

test('specificity ignores :where() and takes the strongest comma branch', () => {
  const css = ':where(#x) .title { color: red } h2, #page h2.title { color: blue }'
  const doc = setup('<div id="page"><h2 class="title">Hi</h2></div>', css)
  const rules = selectorCandidates(doc.querySelector('h2')).filter((c) => c.label.startsWith('CSS rule'))
  assert.equal(rules[0].selector, 'h2, #page h2.title')
  assert.match(rules[0].label, /\(1, 1, 1\)/)
})

test('global * rules are not offered as an existing-rule scope', () => {
  const css = '*, ::before, ::after { box-sizing: border-box } * { margin: 0 } section .title { color: red }'
  const doc = setup('<section class="hero"><h2 class="title">Hi</h2></section>', css)
  const rules = selectorCandidates(doc.querySelector('h2')).filter((c) => c.label.startsWith('CSS rule'))
  assert.deepEqual(rules.map((c) => c.selector), ['section .title'])
})

test('each scope reports how many elements it affects, and broad ones are flagged', () => {
  const items = Array.from({ length: 30 }, () => '<li class="item">x</li>').join('')
  const doc = setup(`<ul class="list">${items}</ul><p class="item">solo</p>`)
  const list = selectorCandidates(doc.querySelectorAll('li')[0])
  assert.equal(list[0].matches, 1)
  assert.equal(list[0].label, 'This element only')
  const all = list.find((c) => c.selector === '.item')
  assert.equal(all.matches, 31)
  assert.match(all.label, /\(31 elements, broad\)/)
  const tag = list.find((c) => c.selector === 'li')
  assert.match(tag.label, /\(30 elements, broad\)/)
  const small = selectorCandidates(doc.querySelector('p'))
  assert.match(small.find((c) => c.selector === '.item').label, /\(31 elements, broad\)/)
  const few = setup('<div class="a"><i class="x">1</i><i class="x">2</i></div>')
  assert.match(selectorCandidates(few.querySelector('i')).find((c) => c.selector === '.x').label, /All \.x \(2 elements\)$/)
})
