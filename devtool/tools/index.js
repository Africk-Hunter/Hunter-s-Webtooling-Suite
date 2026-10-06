import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { server as resizeServer } from './resize/server.js'
import { server as inspectServer } from './inspect/server.js'
import { server as historyServer } from './history/server.js'
import { server as contentServer } from './content/server.js'
import { server as typographyServer } from './typography/server.js'
import { server as spacingServer } from './spacing/server.js'
import { server as colorsServer } from './colors/server.js'

const here = path.dirname(fileURLToPath(import.meta.url))

export const builtinTools = [
  { id: 'resize', client: path.join(here, 'resize', 'client.js'), server: resizeServer },
  { id: 'inspect', client: path.join(here, 'inspect', 'client.js'), server: inspectServer },
  { id: 'history', client: path.join(here, 'history', 'client.js'), server: historyServer },
  { id: 'typography', client: path.join(here, 'typography', 'client.js'), server: typographyServer },
  { id: 'spacing', client: path.join(here, 'spacing', 'client.js'), server: spacingServer },
  { id: 'colors', client: path.join(here, 'colors', 'client.js'), server: colorsServer },
  { id: 'responsive', client: path.join(here, 'responsive', 'client.js'), server: {} },
  { id: 'content', client: path.join(here, 'content', 'client.js'), server: contentServer },
  { id: 'devconsole', client: path.join(here, 'devconsole', 'client.js'), server: {} },
]
