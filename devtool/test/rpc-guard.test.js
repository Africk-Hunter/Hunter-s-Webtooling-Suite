import assert from 'node:assert/strict'
import test from 'node:test'
import { checkRpcRequest } from '../src/rpc-guard.js'

const req = (headers) => ({ headers: { host: 'localhost:5173', 'content-type': 'application/json', 'x-webtool-token': 'tok', ...headers } })
const options = { token: 'tok' }

test('same-origin JSON request with the token is allowed', (t) => {
  assert.equal(checkRpcRequest(req({ origin: 'http://localhost:5173', 'sec-fetch-site': 'same-origin' }), options), null)
  assert.equal(checkRpcRequest(req({}), options), null) // non-browser clients send no Origin
})

test('cross-origin pages are refused, even for the simple text/plain POST that skips preflight', () => {
  assert.match(checkRpcRequest(req({ origin: 'https://evil.example' }), options), /cross-origin/)
  assert.match(checkRpcRequest(req({ origin: 'http://localhost:3000' }), options), /cross-origin/)
  assert.match(checkRpcRequest(req({ 'sec-fetch-site': 'cross-site' }), options), /cross-site/)
  assert.match(checkRpcRequest(req({ 'sec-fetch-site': 'same-site' }), options), /cross-site/)
  assert.match(checkRpcRequest(req({ 'content-type': 'text/plain' }), options), /Content-Type/)
  assert.match(checkRpcRequest(req({ 'content-type': undefined }), options), /Content-Type/)
})

test('a missing or wrong token is refused', () => {
  assert.match(checkRpcRequest(req({ 'x-webtool-token': undefined }), options), /token/)
  assert.match(checkRpcRequest(req({ 'x-webtool-token': 'nope' }), options), /token/)
})

test('DNS-rebound hostnames are refused unless the server is deliberately exposed', () => {
  const rebound = req({ host: 'evil.example:5173', origin: 'http://evil.example:5173' })
  assert.match(checkRpcRequest(rebound, options), /Host/)
  assert.equal(checkRpcRequest(rebound, { ...options, exposed: true }), null)
  assert.equal(checkRpcRequest(req({ host: '127.0.0.1:5173' }), options), null)
  assert.equal(checkRpcRequest(req({ host: '[::1]:5173' }), options), null)
})
