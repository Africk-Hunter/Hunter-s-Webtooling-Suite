import { basename } from 'node:path'

export const SKIP = new Set(['node_modules', 'dist', '.webtool', 'package-lock.json', '.git'])

export function shouldCopy(src) {
  return !SKIP.has(basename(src))
}
