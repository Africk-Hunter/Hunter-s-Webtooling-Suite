import postcss from 'postcss'

const ALLOWED = new Set([
  'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align',
  'text-transform', 'color', 'font-family', 'font-style', 'text-decoration',
])

export const server = {
  // payload: { selector, decls } — only text-related properties are accepted
  apply({ selector, decls, media }, ctx) {
    for (const prop of Object.keys(decls)) if (!ALLOWED.has(prop)) throw new Error(`not a typography property: ${prop}`)
    return ctx.css.setDeclarations(selector, decls, { tool: 'typography', media })
  },
  // CSS custom properties that look like font tokens, for the family dropdown
  tokens: (_, ctx) => {
    const fonts = new Map()
    const sizes = new Map()
    for (const f of ctx.css.files()) {
      const ast = postcss.parse(ctx.fs.read(f))
      ast.walkRules((rule) => {
        if (rule.parent.type !== 'root' || rule.selector.trim() !== ':root') return
        rule.walkDecls((decl) => {
          if (/^--font-[\w-]+$/.test(decl.prop) && !/^--font-(?:size|weight|line-height)(?:-|$)/.test(decl.prop)) {
            fonts.set(decl.prop, decl.value)
          }
          if (/^--(?:font-)?size-[\w-]+$/.test(decl.prop)) sizes.set(decl.prop, decl.value)
        })
      })
    }
    return {
      fonts: [...fonts].map(([name, value]) => ({ name, value })),
      sizes: [...sizes].map(([name, value]) => ({ name, value })),
    }
  },

  applyTokens({ values }, ctx) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('invalid typography token changes')
    for (const [name, value] of Object.entries(values)) {
      if (!/^--(?:font|size)-[\w-]+$/.test(name) || typeof value !== 'string'
        || !value.trim() || /[;{}]/.test(value)) throw new Error(`invalid typography token: ${name}`)
    }
    return ctx.css.setTypographyTokens(values, { tool: 'typography-tokens' })
  },

  applyGoogleFont({ family, selector, media, decls = {} }, ctx) {
    if (typeof family !== 'string' || !/^[\p{L}\p{N} .-]{1,80}$/u.test(family)) throw new Error('invalid font family')
    if (typeof selector !== 'string' || !selector.trim()) throw new Error('choose a CSS selector for this font')
    for (const prop of Object.keys(decls)) if (!ALLOWED.has(prop)) throw new Error(`not a typography property: ${prop}`)
    const file = ctx.project.abs('index.html')
    let html = ctx.fs.read(file)
    if (!/<\/head\s*>/i.test(html)) throw new Error('project index.html has no closing </head>')
    const params = new URLSearchParams({ family: `${family}:wght@400;500;600;700`, display: 'swap' })
    const href = `https://fonts.googleapis.com/css2?${params.toString()}`
    const cssResult = ctx.css.setDeclarations(selector, {
      ...decls,
      'font-family': `'${family}', sans-serif`,
    }, { tool: 'typography', media })
    const unchanged = html.includes(href)
    if (!unchanged) {
      const links = `<link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n    <link href="${href}" rel="stylesheet">`
      html = html.replace(/<\/head\s*>/i, () => `${links}\n  </head>`)
      ctx.write(file, html, { tool: 'typography', label: `load Google Font ${family}` })
    }
    return { file: unchanged ? cssResult.file : ctx.project.rel(file), cssFile: cssResult.file, unchanged }
  },
}
