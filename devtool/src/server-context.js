// Shared server-side helpers handed to every tool handler as `ctx`.
// All source writes MUST go through ctx.write so they are recorded in history and undoable.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import postcss from 'postcss'

const MAX_ENTRIES = 200
const SAFE_PROP = /^[a-z-]+$/
const SAFE_VALUE = /^[^;{}]*$/
const WRAPPER_AT_RULES = new Set(['layer', 'supports'])
const norm = (p) => p.split(path.sep).join('/')

/** Real path of `p`, resolving symlinks in the deepest part that exists (so not-yet-created files work too). */
function realish(p) {
  const tail = []
  for (let cur = p; ; cur = path.dirname(cur)) {
    try { return path.join(fs.realpathSync(cur), ...tail.reverse()) } catch { /* keep climbing */ }
    if (path.dirname(cur) === cur) return p
    tail.push(path.basename(cur))
  }
}
const within = (base, abs) => abs === base || abs.startsWith(base + path.sep)

function walk(dir, ext, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, ext, out)
    else if (e.name.endsWith(ext)) out.push(p)
  }
  return out
}

/** A CSS value that cannot break out of its declaration or leave the stylesheet unparseable. */
export function isSafeValue(value) {
  if (typeof value !== 'string' || !SAFE_VALUE.test(value) || /\/\*|\*\//.test(value)) return false
  let quote = null, depth = 0
  for (let i = 0; i < value.length; i++) {
    const c = value[i]
    if (c === '\\') {
      if (++i >= value.length) return false
    } else if (quote) {
      if (c === quote) quote = null
      else if (c === '\n') return false
    } else if (c === '"' || c === "'") quote = c
    else if (c === '(') depth++
    else if (c === ')' && --depth < 0) return false
  }
  return !quote && depth === 0
}

/** Media query a rule is under (`null` for none), or `undefined` if it sits somewhere we can't address. */
function mediaOf(rule) {
  const media = []
  for (let node = rule.parent; node && node.type !== 'root'; node = node.parent) {
    if (node.type !== 'atrule') return undefined
    if (node.name === 'media') media.push(node.params.trim())
    else if (!WRAPPER_AT_RULES.has(node.name)) return undefined
  }
  return media.length > 1 ? undefined : (media[0] ?? null)
}

const squash = (selector) => selector.replace(/\s+/g, ' ').trim()

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

export function createServerContext(root, { srcDir: srcOption = 'src' } = {}) {
  const projectRoot = path.resolve(root)
  const srcDir = path.resolve(projectRoot, srcOption)
  if (srcDir === projectRoot || !srcDir.startsWith(projectRoot + path.sep)) throw new Error('srcDir must be a folder inside the project root')
  const srcPrefix = norm(path.relative(projectRoot, srcDir)) + '/'
  const historyDir = path.join(projectRoot, '.webtool', 'history')

  const realRoot = realish(projectRoot)
  const realSrc = realish(srcDir)

  // History files live in the project and may come from a cloned repo, so only well-formed entries that
  // point at index.html or a file under the source folder are trusted.
  const validEntry = (e) => e && typeof e === 'object'
    && typeof e.id === 'string' && /^[a-z0-9]+$/.test(e.id)
    && typeof e.file === 'string' && path.posix.normalize(e.file) === e.file
    && (e.file === 'index.html' || (e.file.startsWith(srcPrefix) && !e.file.split('/').includes('..')))
    && typeof e.before === 'string' && typeof e.after === 'string' && Number.isFinite(e.ts)

  // ── history store: in-memory index backed by one JSON file per entry ──
  let entries = []
  try {
    entries = fs.readdirSync(historyDir)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => { try { return [JSON.parse(fs.readFileSync(path.join(historyDir, f), 'utf8'))] } catch { return [] } })
      .filter(validEntry)
      .sort((x, y) => x.ts - y.ts)
  } catch { /* no history yet */ }

  const resolveSrc = (rel) => {
    const abs = path.resolve(srcDir, rel)
    if (abs !== srcDir && !abs.startsWith(srcDir + path.sep)) throw new Error('path outside src/')
    if (!within(realSrc, realish(abs))) throw new Error('path outside src/')
    return abs
  }

  const resolveProject = (rel) => {
    const abs = path.resolve(projectRoot, rel)
    if (abs !== projectRoot && !abs.startsWith(projectRoot + path.sep)) throw new Error('path outside project')
    if (!within(realRoot, realish(abs))) throw new Error('path outside project')
    return abs
  }

  const resolveHistoryFile = (rel) => {
    if (rel.startsWith(srcPrefix)) return resolveProject(rel)
    if (rel === 'index.html') return resolveProject(rel)
    return resolveSrc(rel)
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
      const abs = resolveHistoryFile(e.file)
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
      const abs = resolveHistoryFile(e.file)
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

  /** Write a project file and record it. `file` must remain inside the project root. */
  function write(file, content, meta = {}) {
    const abs = resolveProject(path.relative(projectRoot, path.resolve(file)))
    const before = fs.readFileSync(abs, 'utf8')
    if (before === content) return
    if (abs.endsWith('.css')) {
      try { postcss.parse(content) } catch (e) { throw new Error(`refusing to write invalid CSS to ${norm(path.relative(projectRoot, abs))}: ${e.reason ?? e.message}`) }
    }
    fs.writeFileSync(abs, content)
    const entry = {
      id: Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      ts: Date.now(),
      tool: meta.tool ?? 'unknown',
      label: meta.label ?? 'edit',
      file: norm(path.relative(projectRoot, abs)),
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
        if (!SAFE_PROP.test(k) || !isSafeValue(v)) throw new Error(`rejected declaration ${k}`)
      }
      const label = meta.label ?? `${selector}: ${Object.entries(decls).map(([k, v]) => `${k} ${v}`).join(', ')}`
      const m = { tool: meta.tool, label }
      const sheets = []
      for (const file of css.files()) {
        try {
          const text = fs.readFileSync(file, 'utf8')
          sheets.push({ file, text, ast: postcss.parse(text) })
        } catch { /* a stylesheet that doesn't parse can't be edited safely; leave it alone */ }
      }
      const wanted = squash(selector)
      const wantedMedia = media ? squash(media) : null
      const hits = []
      let baseFile = null
      for (const { file, ast } of sheets) {
        ast.walkRules((rule) => {
          if (squash(rule.selector) !== wanted) return
          const found = mediaOf(rule)
          if (found === undefined) return
          if (found === null && wantedMedia) baseFile = file
          if ((found && squash(found)) === wantedMedia) hits.push({ file, ast, rule })
        })
      }
      const hit = hits.at(-1) // the last matching rule wins the cascade within a file
      if (hit) {
        for (const prop of Object.keys(decls)) hit.rule.walkDecls(prop, (d) => d.remove())
        for (const [prop, value] of Object.entries(decls)) hit.rule.append({ prop, value })
        write(hit.file, hit.ast.toString(), m)
        return { file: norm(path.relative(srcDir, hit.file)), created: false, matches: hits.length }
      }
      const target = sheets.find((s) => s.file === baseFile)
        ?? sheets.find((s) => path.basename(s.file) === 'index.css') ?? sheets[0]
      if (!target) throw new Error('no css files under src/')
      const { file, ast } = target
      const rule = postcss.rule({ selector })
      for (const [prop, value] of Object.entries(decls)) rule.append({ prop, value })
      if (media) {
        let atRule = ast.nodes.find((node) => node.type === 'atrule' && node.name === 'media' && squash(node.params) === wantedMedia)
        if (!atRule) {
          atRule = postcss.atRule({ name: 'media', params: media })
          ast.append(atRule)
        }
        atRule.append(rule)
      } else {
        ast.append(rule)
      }
      write(file, ast.toString(), m)
      // A class that appears in no stylesheet usually means CSS modules, Tailwind or CSS-in-JS: this rule is not the real source.
      const allCss = sheets.map((s) => s.text).join('\n')
      const unknown = [...new Set([...selector.matchAll(/\.((?:\\.|[\w-])+)/g)].map((c) => c[1]))]
        .filter((name) => !new RegExp('\\.' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])').test(allCss))
      const result = { file: norm(path.relative(srcDir, file)), created: true, matches: 0 }
      if (unknown.length) {
        result.warning = `${unknown.map((n) => '.' + n).join(', ')} not found in any stylesheet under src/ (CSS modules, Tailwind or CSS-in-JS?); the new rule is only an override`
      }
      return result
    },

    setCustomProperties(values, meta = {}) {
      if (!values || typeof values !== 'object' || Array.isArray(values) || !Object.keys(values).length) {
        throw new Error('no color token changes supplied')
      }
      for (const [name, value] of Object.entries(values)) {
        if (!/^--color-[\w-]+$/.test(name)) throw new Error(`invalid color token: ${name}`)
        if (!isSafeValue(value) || !value.trim()) throw new Error(`invalid token value for ${name}`)
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

    setTypographyTokens(values, meta = {}) {
      if (!values || typeof values !== 'object' || Array.isArray(values)
        || !Object.keys(values).length || Object.keys(values).length > 100) {
        throw new Error('no typography token changes supplied')
      }
      for (const [name, value] of Object.entries(values)) {
        if (!/^--(?:font|size)-[\w-]+$/.test(name)) throw new Error(`invalid typography token: ${name}`)
        if (value.length > 300 || !isSafeValue(value) || !value.trim()) {
          throw new Error(`invalid token value for ${name}`)
        }
      }
      const files = css.files()
      if (!files.length) throw new Error('no css files under src/')
      const parsed = files.map((file) => ({ file, ast: postcss.parse(fs.readFileSync(file, 'utf8')) }))
      const found = new Set()
      for (const { ast } of parsed) {
        ast.walkRules((rule) => {
          if (rule.parent.type !== 'root' || rule.selector.trim() !== ':root') return
          rule.walkDecls((decl) => {
            if (!Object.hasOwn(values, decl.prop)) return
            decl.value = values[decl.prop]
            found.add(decl.prop)
          })
        })
      }
      const missing = Object.keys(values).filter((name) => !found.has(name))
      if (missing.length) {
        let target = parsed.find(({ file }) => path.basename(file) === 'index.css') ?? parsed[0]
        let rootRule = target.ast.nodes.find((node) => node.type === 'rule' && node.selector.trim() === ':root')
        if (!rootRule) {
          rootRule = postcss.rule({ selector: ':root' })
          target.ast.prepend(rootRule)
        }
        for (const name of missing) rootRule.append({ prop: name, value: values[name] })
      }
      const updated = []
      for (const { file, ast } of parsed) {
        const before = fs.readFileSync(file, 'utf8')
        const after = ast.toString()
        if (before === after) continue
        write(file, after, {
          tool: meta.tool ?? 'typography-tokens',
          label: meta.label ?? Object.entries(values).map(([name, value]) => `${name}: ${value}`).join(', '),
        })
        updated.push(norm(path.relative(srcDir, file)))
      }
      return { file: updated[0], files: updated }
    },
  }

  const source = {
    /** Absolute paths of files under src/ with any of the given extensions. */
    files: (exts = ['.ts', '.tsx']) => exts.flatMap((e) => walk(srcDir, e)),
    rel: (abs) => norm(path.relative(srcDir, abs)),
    abs: resolveSrc,
  }

  const project = {
    abs: resolveProject,
    rel: (abs) => norm(path.relative(projectRoot, abs)),
  }

  /** New binary assets (images). Never overwrites; only under public/ or the source folder. */
  const assets = {
    add(rel, buffer) {
      const abs = resolveProject(rel)
      const relPath = norm(path.relative(projectRoot, abs))
      if (!relPath.startsWith('public/') && !relPath.startsWith(srcPrefix)) throw new Error('assets must go under public/ or the source folder')
      if (fs.existsSync(abs)) throw new Error(`${relPath} already exists`)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, buffer)
      return relPath
    },
    size: (rel) => { try { return fs.statSync(resolveProject(rel)).size } catch { return null } },
  }

  const fsRead = { read: (abs) => fs.readFileSync(abs, 'utf8') }

  return { root: projectRoot, srcDir, css, source, project, assets, fs: fsRead, write, history }
}
