// Webtool Vite plugin. Dev-only. Serves the overlay core + tool client modules,
// and exposes each tool's server handlers over /__webtool/rpc/<tool>/<method>.
//
// Tool definition (see tools/*/index.js):
//   { id, client: '<abs path to client module>', server?: { method(payload, ctx) => result } }
// Extra tools can be passed in: webtool({ tools: [myTool] })
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { builtinTools } from '../tools/index.js'
import { createServerContext } from './server-context.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const CORE = path.join(here, 'client', 'core.js')
const ENTRY = 'virtual:webtool/entry'
const TOOL_PREFIX = 'virtual:webtool/tool/'
const CORE_ID = 'virtual:webtool/core'
const RPC = '/__webtool/rpc/'

export default function webtool(options = {}) {
  const tools = [...builtinTools, ...(options.tools ?? [])]
  let ctx

  return {
    name: 'webtool-devtool',
    apply: 'serve',

    configResolved(config) {
      ctx = createServerContext(config.root)
    },

    resolveId(id) {
      if (id === ENTRY || id === CORE_ID || id.startsWith(TOOL_PREFIX)) return '\0' + id
    },

    load(id) {
      if (id === '\0' + CORE_ID) return fs.readFileSync(CORE, 'utf8')
      if (id.startsWith('\0' + TOOL_PREFIX)) {
        const tool = tools.find((t) => t.id === id.slice(('\0' + TOOL_PREFIX).length))
        return tool && fs.readFileSync(tool.client, 'utf8')
      }
      if (id === '\0' + ENTRY) {
        const imports = tools.map((t, i) => `import t${i} from '${TOOL_PREFIX}${t.id}'`).join('\n')
        return `import { boot } from '${CORE_ID}'\n${imports}\nboot([${tools.map((_, i) => 't' + i).join(',')}])`
      }
    },

    transformIndexHtml(html, ctx) {
      const url = new URL(ctx.originalUrl, 'http://localhost')
      if (url.searchParams.has('__webtool_preview')) return html
      return [{ tag: 'script', attrs: { type: 'module', src: '/@id/__x00__' + ENTRY }, injectTo: 'body' }]
    },

    configureServer(server) {
      // Dev convenience: edits to the core or any tool's client file invalidate the virtual module and reload the page.
      const clientFiles = new Map([[CORE, CORE_ID], ...tools.map((t) => [t.client, TOOL_PREFIX + t.id])])
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
        const [toolId, method] = req.url.replace(/^\//, '').split('/')
        const handler = tools.find((t) => t.id === toolId)?.server?.[method]
        if (!handler) return send(404, { ok: false, error: `no handler ${toolId}/${method}` })
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', async () => {
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
