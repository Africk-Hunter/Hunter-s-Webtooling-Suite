// Shared server-side helpers handed to every tool handler as `ctx`.
// All source writes MUST go through ctx.write so they are recorded in history and undoable.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import postcss from 'postcss'

const MAX_ENTRIES = 200
const SAFE_PROP = /^[a-z-]+$/
const SAFE_VALUE = /^[^;{}]*$/
const norm = (p) => p.split(path.sep).join('/')

function walk(dir, ext, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, ext, out)
    else if (e.name.endsWith(ext)) out.push(p)
  }
  return out
}

/** Compact line diff: trims common head/tail, shows the changed middle with 2 lines of context. */
export function lineDiff(before, after) {
  const a = before.split('\n'), b = after.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length, endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB-- }
  const ctxBefore = a.slice(Math.max(0, start - 2), start)
  const ctxAfter = a.slice(endA, endA + 2)
  return [
    ...ctxBefore.map((l) => '  ' + l),
    ...a.slice(start, endA).map((l) => '- ' + l),
    ...b.slice(start, endB).map((l) => '+ ' + l),
    ...ctxAfter.map((l) => '  ' + l),
  ].join('\n')
}

export function createServerContext(root) {
  const srcDir = path.join(root, 'src')
  const historyDir = path.join(root, '.webtool', 'history')

  // ── history store: in-memory index backed by one JSON file per entry ──
  let entries = []
  try {
    entries = fs.readdirSync(historyDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(historyDir, f), 'utf8')))
      .sort((x, y) => x.ts - y.ts)
  } catch { /* no history yet */ }

  const resolveSrc = (rel) => {
    const abs = path.resolve(srcDir, rel)
    if (abs !== srcDir && !abs.startsWith(srcDir + path.sep)) throw new Error('path outside src/')
    return abs
  }

  const persist = (entry) => {
    fs.mkdirSync(historyDir, { recursive: true })
    fs.writeFileSync(path.join(historyDir, entry.id + '.json'), JSON.stringify(entry))
  }

  const history = {
    list: () => entries.map(({ before, after, ...meta }) => meta).reverse(), // newest first
    get(id) {
      const e = entries.find((x) => x.id === id)
      if (!e) throw new Error('unknown history entry')
      return e
    },
    diff: (id) => lineDiff(history.get(id).before, history.get(id).after),
    undo(id) {
      const e = history.get(id)
      if (e.undone) throw new Error('already undone')
      const abs = resolveSrc(e.file)
      if (fs.readFileSync(abs, 'utf8') !== e.after) {
        throw new Error(`${e.file} changed since this edit (newer edit or manual change); undo newer changes first`)
      }
      fs.writeFileSync(abs, e.before)
      e.undone = true
      persist(e)
      return { file: e.file }
    },
    redo(id) {
      const e = history.get(id)
      if (!e.undone) throw new Error('not undone')
      const abs = resolveSrc(e.file)
      if (fs.readFileSync(abs, 'utf8') !== e.before) {
        throw new Error(`${e.file} changed since the undo; can't redo safely`)
      }
      fs.writeFileSync(abs, e.after)
      e.undone = false
      persist(e)
      return { file: e.file }
    },
    summary() {
      const live = entries.filter((e) => !e.undone)
      if (!live.length) return 'No changes this session.'
      return live.map((e) => `- ${e.label} (${e.file})`).join('\n')
    },
  }

  /** Write a source file and record it. `file` is absolute; meta: { tool, label }. */
  function write(file, content, meta = {}) {
    const abs = path.resolve(file)
    resolveSrc(path.relative(srcDir, abs)) // must be inside src/
    const before = fs.readFileSync(abs, 'utf8')
    if (before === content) return
    fs.writeFileSync(abs, content)
    const entry = {
      id: Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      ts: Date.now(),
      tool: meta.tool ?? 'unknown',
      label: meta.label ?? 'edit',
      file: norm(path.relative(srcDir, abs)),
      before,
      after: content,
      undone: false,
    }
    entries.push(entry)
    persist(entry)
    while (entries.length > MAX_ENTRIES) {
      const old = entries.shift()
      fs.rmSync(path.join(historyDir, old.id + '.json'), { force: true })
    }
    return entry
  }

  const css = {
    files: () => walk(srcDir, '.css'),

    /**
     * Set declarations on a matching rule at the base level or inside one exact media query.
     */
    setDeclarations(selector, decls, meta = {}) {
      if (typeof selector !== 'string' || !selector.trim() || selector.length > 500) throw new Error('invalid selector')
      try {
        const parsed = postcss.parse(`${selector} {}`)
        if (parsed.nodes.length !== 1 || parsed.nodes[0].type !== 'rule'
          || parsed.nodes[0].selector.trim() !== selector || parsed.nodes[0].nodes.length) {
          throw new Error('invalid selector')
        }
      } catch {
        throw new Error('invalid selector')
      }
      const media = meta.media == null ? null : String(meta.media).trim()
      if (media && (media.length > 200 || !/^[\w\s():.%\-]+$/.test(media))) throw new Error('invalid media query')
      if (!decls || typeof decls !== 'object' || Array.isArray(decls) || !Object.keys(decls).length) {
        throw new Error('no CSS declarations supplied')
      }
      for (const [k, v] of Object.entries(decls)) {
        if (!SAFE_PROP.test(k) || typeof v !== 'string' || !SAFE_VALUE.test(v)) throw new Error(`rejected declaration ${k}`)
      }
      const label = meta.label ?? `${selector}: ${Object.entries(decls).map(([k, v]) => `${k} ${v}`).join(', ')}`
      const m = { tool: meta.tool, label }
      const files = css.files()
      let hit = null
      let baseFile = null
      for (const file of files) {
        const ast = postcss.parse(fs.readFileSync(file, 'utf8'))
        if (media) {
          ast.walkRules((rule) => {
            if (rule.parent.type === 'root' && rule.selector.trim() === selector) baseFile = file
          })
        }
        const scope = media
          ? ast.nodes.find((node) => node.type === 'atrule' && node.name === 'media' && node.params.trim() === media)
          : ast
        if (!scope) continue
        scope.walkRules((rule) => {
          if (!media && rule.parent.type !== 'root') return
          if (rule.selector.trim() === selector) hit = { file, ast, rule, scope }
        })
      }
      if (hit) {
        for (const prop of Object.keys(decls)) hit.rule.walkDecls(prop, (d) => d.remove())
        for (const [prop, value] of Object.entries(decls)) hit.rule.append({ prop, value })
        write(hit.file, hit.ast.toString(), m)
        return { file: norm(path.relative(srcDir, hit.file)), created: false }
      }
      let file = baseFile ?? files.find((f) => path.basename(f) === 'index.css') ?? files[0]
      if (!file) throw new Error('no css files under src/')
      const ast = postcss.parse(fs.readFileSync(file, 'utf8'))
      const rule = postcss.rule({ selector })
      for (const [prop, value] of Object.entries(decls)) rule.append({ prop, value })
      if (media) {
        let atRule = ast.nodes.find((node) => node.type === 'atrule' && node.name === 'media' && node.params.trim() === media)
        if (!atRule) {
          atRule = postcss.atRule({ name: 'media', params: media })
          ast.append(atRule)
        }
        atRule.append(rule)
      } else {
        ast.append(rule)
      }
      write(file, ast.toString(), m)
      return { file: norm(path.relative(srcDir, file)), created: true }
    },

    setCustomProperties(values, meta = {}) {
      if (!values || typeof values !== 'object' || Array.isArray(values) || !Object.keys(values).length) {
        throw new Error('no color token changes supplied')
      }
      for (const [name, value] of Object.entries(values)) {
        if (!/^--color-[\w-]+$/.test(name)) throw new Error(`invalid color token: ${name}`)
        if (typeof value !== 'string' || !SAFE_VALUE.test(value) || !value.trim()) throw new Error(`invalid token value for ${name}`)
      }
      const updated = []
      const found = new Set()
      const changes = []
      for (const file of css.files()) {
        const ast = postcss.parse(fs.readFileSync(file, 'utf8'))
        let changed = false
        ast.walkRules((rule) => {
          if (rule.parent.type !== 'root' || rule.selector.trim() !== ':root') return
          rule.walkDecls((decl) => {
            if (!Object.hasOwn(values, decl.prop)) return
            decl.value = values[decl.prop]
            found.add(decl.prop)
            changed = true
          })
        })
        if (changed) changes.push({ file, ast })
      }
      const missing = Object.keys(values).filter((name) => !found.has(name))
      if (missing.length) throw new Error(`color token not found: ${missing.join(', ')}`)
      for (const { file, ast } of changes) {
        write(file, ast.toString(), {
          tool: meta.tool ?? 'colors',
          label: meta.label ?? Object.entries(values).map(([name, value]) => `${name}: ${value}`).join(', '),
        })
        updated.push(norm(path.relative(srcDir, file)))
      }
      if (!updated.length) throw new Error('none of the selected color tokens were found in :root')
      return { file: updated[0], files: updated }
    },
  }

  const source = {
    /** Absolute paths of files under src/ with any of the given extensions. */
    files: (exts = ['.ts', '.tsx']) => exts.flatMap((e) => walk(srcDir, e)),
    rel: (abs) => norm(path.relative(srcDir, abs)),
    abs: resolveSrc,
  }

  const fsRead = { read: (abs) => fs.readFileSync(abs, 'utf8') }

  return { root, srcDir, css, source, fs: fsRead, write, history }
}
