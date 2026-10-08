// Request checks for /__webtool/rpc. The endpoint writes to the user's source files, so a page on any other
// site (or a DNS-rebound hostname) must not be able to reach it just because the dev server is running.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

const hostnameOf = (host) => {
  try { return new URL('http://' + host).hostname } catch { return '' }
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {{ token?: string, exposed?: boolean }} options `exposed`: dev server is deliberately reachable beyond loopback
 * @returns {string | null} reason to refuse, or null when the request is allowed
 */
export function checkRpcRequest(req, { token, exposed = false } = {}) {
  const host = req.headers.host ?? ''
  if (!exposed && !LOOPBACK.has(hostnameOf(host))) return 'unexpected Host header'
  const origin = req.headers.origin
  if (origin) {
    let parsed
    try { parsed = new URL(origin) } catch { return 'invalid Origin header' }
    if (parsed.host !== host) return 'cross-origin request refused'
  }
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin' && site !== 'none') return 'cross-site request refused'
  // A JSON content type is not a "simple" CORS request, so browsers preflight it instead of sending it blind.
  if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) return 'Content-Type must be application/json'
  if (token && req.headers['x-webtool-token'] !== token) return 'missing or invalid webtool token'
  return null
}
