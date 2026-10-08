import type { Plugin } from 'vite'

export interface WebtoolTool {
  /** Unique id; also the RPC route segment and virtual module name. */
  id: string
  /** Absolute path to the tool's browser module (default-exports the tool object). */
  client: string
  /** Server handlers: `method(payload, ctx)`, reached via `POST /__webtool/rpc/<id>/<method>`. */
  server?: Record<string, (payload: any, ctx: any) => unknown>
}

export interface WebtoolOptions {
  /** Extra tools appended after the built-ins. */
  tools?: WebtoolTool[]
  /** Built-in tool ids to leave out, e.g. `['devconsole']`. */
  disable?: string[]
  /** Source folder relative to the project root. Default `'src'`. */
  srcDir?: string
  /** Allow other machines to use the source-writing endpoint when `server.host` exposes the dev server. Default `false`. */
  allowRemote?: boolean
}

export default function webtool(options?: WebtoolOptions): Plugin
