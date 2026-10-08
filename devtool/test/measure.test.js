import assert from 'node:assert/strict'
import test from 'node:test'
import { alignments, gridOffset, measure } from '../tools/measure/client.js'

const rect = (left, top, right, bottom) => ({ left, top, right, bottom })

test('horizontal gap between side-by-side boxes, measured at their shared height', () => {
  const [s] = measure(rect(0, 0, 100, 50), rect(120, 10, 200, 40))
  assert.deepEqual([s.orient, s.px, s.y1], ['h', 20, 25])
})

test('vertical gap between stacked boxes, measured at their shared width', () => {
  const segs = measure(rect(0, 0, 100, 50), rect(20, 80, 60, 120))
  assert.equal(segs.length, 1)
  assert.deepEqual([segs[0].orient, segs[0].px, segs[0].x1], ['v', 30, 40])
})

test('works regardless of which box is the anchor', () => {
  const a = rect(0, 0, 100, 50), b = rect(130, 0, 200, 50)
  assert.equal(measure(a, b)[0].px, 30)
  assert.equal(measure(b, a)[0].px, 30)
})

test('nested boxes report all four inner offsets', () => {
  const segs = measure(rect(0, 0, 200, 100), rect(10, 20, 150, 60))
  assert.deepEqual(segs.map((s) => s.px).sort((x, y) => x - y), [10, 20, 40, 50])
})

test('touching or overlapping boxes produce no zero-length segments', () => {
  assert.deepEqual(measure(rect(0, 0, 100, 50), rect(100, 0, 150, 50)), [])
  assert.deepEqual(measure(rect(0, 0, 100, 50), rect(50, 25, 150, 75)), [])
})

test('alignments find shared edges and centres within tolerance', () => {
  const found = alignments(rect(0, 0, 100, 50), rect(0, 100, 100, 150))
  assert.ok(found.some((g) => g.axis === 'x' && g.a === 'left' && g.b === 'left'))
  assert.ok(found.some((g) => g.axis === 'x' && g.a === 'center' && g.b === 'center'))
  assert.ok(!found.some((g) => g.axis === 'y'))
  assert.equal(alignments(rect(0, 0, 100, 50), rect(300, 300, 400, 400)).length, 0)
})

test('gridOffset reports distance from the nearest grid line', () => {
  assert.equal(gridOffset(16, 8), 0)
  assert.equal(gridOffset(19, 8), 3)
  assert.equal(gridOffset(21, 8), 3)
})
