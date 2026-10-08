import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { audit, contrastRatio, parseColor } from '../tools/a11y/client.js'

function run(body, { rect } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`)
  globalThis.CSS = { escape: (v) => String(v).replace(/[^\w-]/g, (c) => `\\${c}`) }
  return audit(dom.window.document, { rect: rect ?? (() => ({ width: 100, height: 40 })) })
}
const rules = (issues) => issues.map((i) => i.rule)

test('parseColor handles rgb, rgba and unsupported formats', () => {
  assert.deepEqual(parseColor('rgb(1, 2, 3)'), { r: 1, g: 2, b: 3, a: 1 })
  assert.equal(parseColor('rgba(0, 0, 0, 0.5)').a, 0.5)
  assert.equal(parseColor('oklch(0.5 0.1 200)'), null)
})

test('contrastRatio matches WCAG reference values', () => {
  const black = { r: 0, g: 0, b: 0 }, white = { r: 255, g: 255, b: 255 }
  assert.equal(Math.round(contrastRatio(black, white)), 21)
  assert.ok(Math.abs(contrastRatio({ r: 119, g: 119, b: 119 }, white) - 4.48) < 0.02)
})

test('flags low contrast, passes sufficient contrast, relaxes for large text', () => {
  const low = run('<h1 style="color:#777;background:#fff;font-size:16px">x</h1>')
  assert.deepEqual(rules(low), ['contrast'])
  assert.deepEqual(rules(run('<h1 style="color:#000;background:#fff">x</h1>')), [])
  assert.deepEqual(rules(run('<h1 style="color:#777;background:#fff;font-size:30px">x</h1>')), [])
})

test('contrast uses the nearest opaque ancestor background and skips images', () => {
  assert.deepEqual(rules(run('<div style="background:#000"><h1 style="color:#222">x</h1></div>')), ['contrast'])
  assert.deepEqual(rules(run('<div style="background-image:url(a.png)"><h1 style="color:#fff">x</h1></div>')), [])
})

test('flags images without alt but accepts empty alt', () => {
  const issues = run('<h1>t</h1><img src="a.png"><img src="b.png" alt="">')
  assert.deepEqual(rules(issues), ['img-alt'])
})

test('flags skipped heading levels and a missing h1', () => {
  assert.deepEqual(rules(run('<h1>a</h1><h3>b</h3>')), ['heading-order'])
  assert.match(run('<h2>a</h2>')[0].message, /no h1/)
})

test('flags unnamed links/buttons and unlabeled form controls', () => {
  const issues = run('<h1>t</h1><a href="/"></a><button></button><button aria-label="Go"></button><input><label for="n">N</label><input id="n"><a href="/"><img src="x.png" alt="Home"></a>')
  assert.deepEqual(rules(issues).sort(), ['label', 'name', 'name'])
})

test('flags small tap targets but not inline links or hidden elements', () => {
  const small = (el) => (el.tagName === 'BUTTON' ? { width: 16, height: 16 } : { width: 100, height: 40 })
  assert.deepEqual(rules(run('<h1>t</h1><button>x</button>', { rect: small })), ['tap-target'])
  assert.deepEqual(rules(run('<h1>t</h1><p><a href="/">link</a></p>', { rect: () => ({ width: 30, height: 12 }) })), [])
  assert.deepEqual(rules(run('<h1>t</h1><button>x</button>', { rect: () => ({ width: 0, height: 0 }) })), [])
})
