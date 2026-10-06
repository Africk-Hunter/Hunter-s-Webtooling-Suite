import fs from 'node:fs'
import path from 'node:path'

export const server = {
  // payload: { selector } -> source locations of rules mentioning the selector
  locate: ({ selector }, ctx) => {
    const hits = []
    for (const file of ctx.css.files()) {
      fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.includes(selector)) hits.push(`${path.relative(ctx.srcDir, file)}:${i + 1}`)
      })
    }
    return hits.slice(0, 8)
  },
}
