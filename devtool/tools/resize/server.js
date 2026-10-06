export const server = {
  // payload: { selector, decls: { width?, height? }, media? }
  apply: ({ selector, decls, media }, ctx) => ctx.css.setDeclarations(selector, decls, { tool: 'resize', media }),
}
