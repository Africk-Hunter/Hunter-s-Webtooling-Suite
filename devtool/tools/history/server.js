export const server = {
  list: (_, ctx) => ctx.history.list(),
  diff: ({ id }, ctx) => ctx.history.diff(String(id)),
  undo: ({ id }, ctx) => ctx.history.undo(String(id)),
  redo: ({ id }, ctx) => ctx.history.redo(String(id)),
  summary: (_, ctx) => ctx.history.summary(),
}
