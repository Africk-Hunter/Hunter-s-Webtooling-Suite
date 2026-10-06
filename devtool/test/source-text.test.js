import assert from 'node:assert/strict'
import test from 'node:test'
import { findText, replaceAt } from '../src/source-text.js'

test('matches JSX text containing HTML entities', () => {
  const source = '<p>Good &amp; kind&#33;</p>'
  const [match] = findText(source, 'Good & kind!', { jsx: true }).filter((item) => item.kind === 'jsx-rich')
  assert.ok(match)
  assert.equal(replaceAt(source, match, 'Good & better!'), '<p>Good &amp; better!</p>')
})

test('edits inline rich JSX while preserving only safe semantic markup', () => {
  const source = '<p>A <strong>good</strong> <a href="https://example.com">idea</a></p>'
  const [match] = findText(source, 'A good idea', { jsx: true }).filter((item) => item.kind === 'jsx-rich')
  assert.ok(match)
  const updated = replaceAt(source, match, 'A <strong>better</strong> <a href="https://example.com">idea</a>')
  assert.equal(updated, '<p>A <strong>better</strong> <a href="https://example.com">idea</a></p>')
})

test('rejects unsafe markup and link protocols in rich content', () => {
  const source = '<p>Safe text</p>'
  const [match] = findText(source, 'Safe text', { jsx: true }).filter((item) => item.kind === 'jsx-rich')
  assert.ok(match)
  assert.throws(() => replaceAt(source, match, '<img src=x>'), /unsupported rich text element/)
  assert.throws(() => replaceAt(source, match, '<a href="javascript:alert(1)">x</a>'), /unsafe link URL/)
})

test('finds a template literal with only static interpolation', () => {
  const source = 'const heading = `A ${\'better\'} idea`'
  const [match] = findText(source, 'A better idea', { jsx: false }).filter((item) => item.kind === 'template')
  assert.ok(match)
  assert.equal(replaceAt(source, match, 'A new idea'), 'const heading = `A new idea`')
})

test('does not claim a dynamic template interpolation can be source-mapped', () => {
  const source = 'const heading = `Hello ${name}`'
  assert.equal(findText(source, 'Hello Jamie', { jsx: false }).length, 0)
})
