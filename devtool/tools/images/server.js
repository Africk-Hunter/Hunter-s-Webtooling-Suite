import fs from 'node:fs'
import path from 'node:path'

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i
const MAX_BYTES = 10 * 1024 * 1024
const LITERAL = /(['"`])([^'"`\n\\]+)\1/g

/** '/src/assets/a.png?t=1' -> 'src/assets/a.png' */
const cleanSrc = (src) => {
  let p = String(src)
  try { p = new URL(p, 'http://x').pathname } catch { /* keep as is */ }
  return decodeURIComponent(p).replace(/^\/+/, '')
}
const bare = (value) => value.split('?')[0].replace(/^(\.{1,2}\/)+/, '').replace(/^\/+/, '')

/** String literals in TS/TSX source that refer to the rendered image URL. */
export function findImageRefs(content, src) {
  const target = cleanSrc(src)
  const out = []
  let offset = 0
  content.split('\n').forEach((text, i) => {
    for (const m of text.matchAll(LITERAL)) {
      const value = m[2]
      if (!IMAGE_EXT.test(value.split('?')[0])) continue
      const b = bare(value)
      if (b && (target === b || target.endsWith('/' + b))) {
        out.push({ line: i + 1, start: offset + m.index + 1, length: value.length, value, snippet: text.trim().slice(0, 100) })
      }
    }
    offset += text.length + 1
  })
  return out
}

function refs(src, ctx) {
  const out = []
  for (const abs of ctx.source.files(['.ts', '.tsx'])) {
    for (const ref of findImageRefs(fs.readFileSync(abs, 'utf8'), src)) out.push({ file: ctx.source.rel(abs), ...ref })
  }
  return out
}

export const server = {
  // payload: { src } -> bytes on disk (when local) and source references
  inspect({ src }, ctx) {
    if (typeof src !== 'string' || !src || src.length > 2000) throw new Error('bad src')
    const target = cleanSrc(src)
    const bytes = ctx.assets.size(target) ?? ctx.assets.size('public/' + target)
    return { bytes, refs: refs(src, ctx) }
  },

  // payload: { srcs: string[] } -> bytes on disk per src (null when remote); no source scan, so it stays cheap for page scans
  sizes({ srcs }, ctx) {
    if (!Array.isArray(srcs) || srcs.length > 200 || srcs.some((s) => typeof s !== 'string' || !s || s.length > 2000)) throw new Error('bad srcs')
    return srcs.map((src) => {
      try {
        const target = cleanSrc(src)
        return ctx.assets.size(target) ?? ctx.assets.size('public/' + target)
      } catch { return null }
    })
  },

  // payload: { src, name, data (base64), file, line, start }
  swap({ src, name, data, file, line, start }, ctx) {
    if (typeof name !== 'string' || !/^\w[\w.-]*$/.test(name) || !IMAGE_EXT.test(name)) throw new Error('unsupported file name')
    if (typeof data !== 'string' || !data) throw new Error('no file data')
    const buffer = Buffer.from(data, 'base64')
    if (!buffer.length || buffer.length > MAX_BYTES) throw new Error('image must be between 1 byte and 10MB')
    const ref = refs(src, ctx).find((r) => r.file === file && r.line === line && r.start === start)
    if (!ref) throw new Error('image reference moved; reselect the image')
    const abs = ctx.source.abs(file)
    const content = fs.readFileSync(abs, 'utf8')
    const rootAbsolute = ref.value.startsWith('/')
    const assetRel = rootAbsolute ? `public/images/${name}` : `${ctx.project.rel(ctx.srcDir)}/assets/${name}`
    const written = ctx.assets.add(assetRel, buffer)
    let literal = '/images/' + name
    if (!rootAbsolute) {
      const rel = path.relative(path.dirname(abs), ctx.project.abs(written)).split(path.sep).join('/')
      literal = rel.startsWith('.') ? rel : './' + rel
    }
    ctx.write(abs, content.slice(0, ref.start) + literal + content.slice(ref.start + ref.length), {
      tool: 'images',
      label: `image ${path.basename(ref.value)} → ${name}`,
    })
    return { file, line, asset: written, value: literal }
  },
}
