// Plugin option validation and tool-list resolution.
import { builtinTools } from '../tools/index.js'

const KNOWN = new Set(['tools', 'disable', 'srcDir', 'allowRemote'])

/**
 * Validate `webtool(options)` and resolve the active tool list.
 *   tools:   extra tool entries `{ id, client, server? }` appended after the built-ins
 *   disable: built-in tool ids to leave out
 *   srcDir:  source folder, relative to the project root (default 'src')
 *   allowRemote: let other machines use the write endpoint when the dev server is exposed with `server.host` (default false)
 */
export function resolveOptions(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('webtool(options): options must be an object')
  const unknown = Object.keys(options).filter((key) => !KNOWN.has(key))
  if (unknown.length) throw new TypeError(`webtool(options): unknown option ${unknown.join(', ')} (expected ${[...KNOWN].join(', ')})`)

  const { tools: extra = [], disable = [], srcDir = 'src', allowRemote = false } = options
  if (!Array.isArray(extra)) throw new TypeError('webtool(options): tools must be an array')
  if (!Array.isArray(disable)) throw new TypeError('webtool(options): disable must be an array of tool ids')
  if (typeof srcDir !== 'string' || !srcDir.trim()) throw new TypeError('webtool(options): srcDir must be a non-empty string')

  const builtinIds = new Set(builtinTools.map((tool) => tool.id))
  for (const id of disable) {
    if (!builtinIds.has(id)) throw new TypeError(`webtool(options): cannot disable unknown built-in tool "${id}"`)
  }
  const ids = new Set(builtinIds)
  for (const tool of extra) {
    if (!tool || typeof tool.id !== 'string' || !/^[a-z][\w-]*$/i.test(tool.id)) throw new TypeError('webtool(options): each custom tool needs a string id (letters, digits, - or _)')
    if (typeof tool.client !== 'string') throw new TypeError(`webtool(options): tool "${tool.id}" needs a client file path`)
    if (ids.has(tool.id)) throw new TypeError(`webtool(options): duplicate tool id "${tool.id}"`)
    ids.add(tool.id)
  }
  if (typeof allowRemote !== 'boolean') throw new TypeError('webtool(options): allowRemote must be a boolean')
  return {
    allowRemote,
    tools: [...builtinTools.filter((tool) => !disable.includes(tool.id)), ...extra],
    srcDir,
  }
}
