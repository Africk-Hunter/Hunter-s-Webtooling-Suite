// Webtool Vite plugin. Dev-only. Serves the overlay core + tool client modules,
// and exposes each tool's server handlers over /__webtool/rpc/<tool>/<method>.
//
// Tool definition (see tools/*/index.js):
//   { id, client: '<abs path to client module>', server?: { method(payload, ctx) => result } }
// Extra tools can be passed in: webtool({ tools: [myTool] })
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveOptions } from './options.js'
import { checkRpcRequest } from './rpc-guard.js'
import { createServerContext } from './server-context.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const CORE = path.join(here, 'client', 'core.js')
const SELECTORS = path.join(here, 'client', 'selectors.js')
const ENTRY = 'virtual:webtool/entry'
const TOOL_PREFIX = 'virtual:webtool/tool/'
const CORE_ID = 'virtual:webtool/core'
const SELECTORS_ID = 'virtual:webtool/selectors'
const RPC = '/__webtool/rpc/'
const MAX_BODY = 16 * 1024 * 1024

export default function webtool(options = {}) {
  const { tools, srcDir, allowRemote } = resolveOptions(options)
  let ctx
  let exposed = false
  const token = crypto.randomBytes(16).toString('hex') // per dev-server run; the overlay sends it back with every call

  return {
    name: 'webtool-devtool',
    apply: 'serve',

    configResolved(config) {
      ctx = createServerContext(config.root, { srcDir })
      const { host, allowedHosts } = config.server
      exposed = (host !== undefined && host !== false && !['localhost', '127.0.0.1', '::1'].includes(host)) || !!allowedHosts?.length || allowedHosts === true
      if (exposed && !allowRemote) {
        config.logger.warn('[webtool] dev server is reachable beyond localhost, so webtool source writes are disabled. Pass webtool({ allowRemote: true }) to allow them.')
      }
    },

    resolveId(id) {
      if (id === ENTRY || id === CORE_ID || id === SELECTORS_ID || id.startsWith(TOOL_PREFIX)) return '\0' + id
    },

    load(id) {
      if (id === '\0' + CORE_ID) return fs.readFileSync(CORE, 'utf8')
      if (id === '\0' + SELECTORS_ID) return fs.readFileSync(SELECTORS, 'utf8')
      if (id.startsWith('\0' + TOOL_PREFIX)) {
        const tool = tools.find((t) => t.id === id.slice(('\0' + TOOL_PREFIX).length))
        return tool && fs.readFileSync(tool.client, 'utf8')
      }
      if (id === '\0' + ENTRY) {
        const imports = tools.map((t, i) => `import t${i} from '${TOOL_PREFIX}${t.id}'`).join('\n')
        return `import { boot } from '${CORE_ID}'\n${imports}\nboot([${tools.map((_, i) => 't' + i).join(',')}], ${JSON.stringify({ token })})`
      }
    },

    transformIndexHtml(html, ctx) {
      const url = new URL(ctx.originalUrl, 'http://localhost')
      if (url.searchParams.has('__webtool_preview')) return html
      return [{ tag: 'script', attrs: { type: 'module', src: '/@id/__x00__' + ENTRY }, injectTo: 'body' }]
    },

    configureServer(server) {
      // Dev convenience: edits to the core or any tool's client file invalidate the virtual module and reload the page.
      const clientFiles = new Map([[CORE, CORE_ID], [SELECTORS, SELECTORS_ID], ...tools.map((t) => [t.client, TOOL_PREFIX + t.id])])
      server.watcher.add([...clientFiles.keys()])
      server.watcher.on('change', (file) => {
        const id = clientFiles.get(path.normalize(file))
        if (!id) return
        for (const vid of [id, ENTRY]) {
          const mod = server.moduleGraph.getModuleById('\0' + vid)
          if (mod) server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
      })
      server.middlewares.use(RPC, (req, res) => {
        const send = (code, body) => {
          res.statusCode = code
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        if (req.method !== 'POST') return send(405, { ok: false, error: 'POST only' })
        const refusal = exposed && !allowRemote
          ? 'source writes are disabled while the dev server is exposed (set allowRemote to enable)'
          : checkRpcRequest(req, { token, exposed })
        if (refusal) return send(403, { ok: false, error: refusal })
        const [toolId, method] = req.url.replace(/^\//, '').split('/')
        const handlers = tools.find((t) => t.id === toolId)?.server
        const handler = handlers && Object.hasOwn(handlers, method) && typeof handlers[method] === 'function' ? handlers[method] : null
        if (!handler) return send(404, { ok: false, error: `no handler ${toolId}/${method}` })
        let body = ''
        let tooLarge = false
        req.setEncoding('utf8')
        req.on('data', (c) => {
          if (tooLarge) return
          body += c
          if (body.length > MAX_BODY) { tooLarge = true; send(413, { ok: false, error: 'payload too large' }); req.destroy() }
        })
        req.on('end', async () => {
          if (tooLarge) return
          try {
            send(200, { ok: true, result: await handler(JSON.parse(body || '{}'), ctx) })
          } catch (e) {
            send(400, { ok: false, error: String(e.message ?? e) })
          }
        })
      })
    },
  }
}
