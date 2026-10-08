// Source tool: map the selected element to the JSX that rendered it (React dev builds) and open it in VS Code.
let box

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]))

/**
 * Walks the React fiber chain from a DOM node. Returns [{ name, file, line, column }]:
 * the element's own JSX first, then each enclosing component's usage site.
 * Needs React 18 dev (`_debugSource`); returns [] otherwise.
 */
export function sourceChain(el) {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))
  const out = []
  for (let fiber = key ? el[key] : null; fiber && out.length < 12; fiber = fiber.return) {
    const src = fiber._debugSource
    if (!src?.fileName) continue
    const type = fiber.type
    const name = typeof type === 'string' ? `<${type}>` : (type?.displayName || type?.name || null)
    if (!name) continue
    out.push({ name, file: src.fileName, line: src.lineNumber, column: src.columnNumber ?? 1 })
  }
  return out
}

const short = (file) => file.split(String.fromCharCode(92)).join('/').split('/').slice(-2).join('/')

export default {
  id: 'source',
  name: 'Source',
  hotkey: 'o',

  activate(api) {
    box = api.box({ outline: '2px solid #a78bfa' })
    api.panel.set('<div class="muted">Click an element to find the component source that rendered it.</div>')
  },

  onSelect(el, api) {
    box.follow(el)
    const chain = sourceChain(el)
    if (!chain.length) {
      api.panel.set(`<b>Source</b><div class="muted">No React source info for ${esc(api.selectorFor(el))}. Needs a React 18 dev build with the JSX dev transform.</div>`)
      return
    }
    api.panel.set(`<b>Source · ${esc(api.selectorFor(el))}</b>
      ${chain.map((hit, i) => `<div class="scale-sample"><small>${i === 0 ? 'rendered by' : 'used in'}</small>
        <span>${esc(hit.name)}</span><small>${esc(short(hit.file))}:${hit.line}</small>
        <button class="s open" data-index="${i}">Open in VS Code</button></div>`).join('')}
      <div class="muted msg"></div>`)
    api.panel.el.querySelectorAll('.open').forEach((button) => {
      button.onclick = async () => {
        const { file, line, column } = chain[Number(button.dataset.index)]
        try {
          await api.rpc('open', { file, line, column })
          api.panel.el.querySelector('.msg').textContent = 'Opening…'
        } catch (error) {
          api.panel.el.querySelector('.msg').textContent = 'Error: ' + error.message
        }
      }
    })
  },

  deactivate() { box?.destroy() },
}
