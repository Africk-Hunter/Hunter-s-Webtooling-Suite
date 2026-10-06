export const server = {
  // payload: { selector, decls: { margin-top?, padding-left?, ... }, media? }
  apply: ({ selector, decls, media }, ctx) => ctx.css.setDeclarations(selector, decls, { tool: 'spacing', media }),
}
