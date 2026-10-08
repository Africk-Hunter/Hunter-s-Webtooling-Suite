import assert from 'node:assert/strict'
import test from 'node:test'
import { diffPixels } from '../tools/snapshots/client.js'

const solid = (width, height, [r, g, b, a = 255]) => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) data.set([r, g, b, a], i)
  return { data, width, height }
}

test('identical images have no differences', () => {
  const result = diffPixels(solid(4, 4, [10, 20, 30]), solid(4, 4, [10, 20, 30]))
  assert.equal(result.changed, 0)
  assert.equal(result.ratio, 0)
})

test('a changed region is counted and painted magenta', () => {
  const a = solid(4, 4, [255, 255, 255]), b = solid(4, 4, [255, 255, 255])
  b.data.set([0, 0, 0, 255], 0)
  b.data.set([0, 0, 0, 255], 4)
  const result = diffPixels(a, b)
  assert.equal(result.changed, 2)
  assert.equal(result.ratio, 2 / 16)
  assert.deepEqual([...result.diff.slice(0, 4)], [236, 72, 153, 255])
})

test('differences below the threshold are ignored', () => {
  assert.equal(diffPixels(solid(2, 2, [100, 100, 100]), solid(2, 2, [110, 100, 100])).changed, 0)
  assert.equal(diffPixels(solid(2, 2, [100, 100, 100]), solid(2, 2, [150, 100, 100])).changed, 4)
})

test('size mismatches count the extra area as changed', () => {
  const result = diffPixels(solid(2, 2, [0, 0, 0]), solid(2, 4, [0, 0, 0]))
  assert.equal(result.height, 4)
  assert.equal(result.changed, 4)
  assert.equal(result.total, 8)
})
