import postcss from 'postcss'

export const server = {
  tokens: (_, ctx) => {
    const found = new Map()
    for (const file of ctx.css.files()) {
      const ast = postcss.parse(ctx.fs.read(file))
      ast.walkRules((rule) => {
        if (rule.parent.type !== 'root' || rule.selector.trim() !== ':root') return
        rule.walkDecls(/^--color-[\w-]+$/, (decl) => found.set(decl.prop, decl.value))
      })
    }
    return [...found].map(([name, value]) => ({ name, value }))
  },

  apply({ values }, ctx) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('invalid token changes')
    for (const [name, value] of Object.entries(values)) {
      if (!/^--color-[\w-]+$/.test(name) || typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) {
        throw new Error(`invalid color token change: ${name}`)
      }
    }
    return ctx.css.setCustomProperties(values, { tool: 'colors' })
  },
}
