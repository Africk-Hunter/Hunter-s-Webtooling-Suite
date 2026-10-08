import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const UNSAFE = /["%^&|<>`$\r\n]/

function launchEditor(abs, line, column) {
  const target = `${abs}:${line}:${column}`
  const win = process.platform === 'win32'
  const child = spawn('code', ['-g', win ? `"${target}"` : target], { shell: win, stdio: 'ignore', detached: true })
  child.on('error', () => {})
  child.unref()
}

export const server = {
  // payload: { file (absolute or project-relative), line, column? }
  open({ file, line, column = 1 }, ctx) {
    if (typeof file !== 'string' || !file || UNSAFE.test(file)) throw new Error('invalid file')
    if (!Number.isInteger(line) || line < 1 || !Number.isInteger(column) || column < 1) throw new Error('invalid position')
    const abs = ctx.project.abs(path.isAbsolute(file) ? path.relative(ctx.root, file) : file)
    if (!fs.statSync(abs, { throwIfNoEntry: false })?.isFile()) throw new Error('file not found')
    if (abs.split(path.sep).includes('node_modules')) throw new Error('refusing to open dependency files')
    ;(ctx.editor?.open ?? launchEditor)(abs, line, column)
    return { file: ctx.project.rel(abs), line, column }
  },
}
