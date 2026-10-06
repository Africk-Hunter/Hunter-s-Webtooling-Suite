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
    const found = new Set()
    for (const f of ctx.css.files()) {
      for (const m of ctx.fs.read(f).matchAll(/(--font-[\w-]+)\s*:/g)) found.add(m[1])
    }
    return [...found]
  },
}
