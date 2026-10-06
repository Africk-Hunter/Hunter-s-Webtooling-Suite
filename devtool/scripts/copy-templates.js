import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SKIP, shouldCopy } from '../bin/copy-filter.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const from = join(root, '..', 'Site Templates')
const to = join(root, 'templates')

if (!existsSync(from)) throw new Error(`Site Templates not found at ${from}`)
rmSync(to, { recursive: true, force: true })
cpSync(from, to, { recursive: true, filter: shouldCopy })
console.log(`Bundled templates (skipping ${[...SKIP].join(', ')})`)
