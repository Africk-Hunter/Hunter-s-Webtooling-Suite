// Content tool: edit text directly on the page; Apply writes it to the string in source that rendered it.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

let api, box, el, original, originalHtml, matches

function stopEditing(restoreText) {
  if (!el) return
  el.removeAttribute('contenteditable')
  if (restoreText && el.innerHTML !== originalHtml) el.innerHTML = originalHtml
  el = null
}

export default {
  id: 'content',
  name: 'Content',
  hotkey: 'c',

  activate(a) {
    api = a
    box = api.box({ outline: '2px solid #ff9f0a' })
    api.panel.set('<div class="muted">Click a piece of text to edit it.</div>')
  },

  async onSelect(target) {
    stopEditing(true)
    const richTags = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'A', 'BR'])
    const unsupported = [...target.querySelectorAll('*')].some((child) => !richTags.has(child.tagName)
      || (child.tagName === 'A' && !/^(https?:|mailto:|tel:|\/|#)/i.test(child.getAttribute('href') ?? '')))
    if (unsupported) {
      box.follow(target)
      return api.panel.set('<div class="muted">That element contains unsupported content. Select plain text or inline bold, italic, underline, links, and line breaks.</div>')
    }
    el = target
    original = el.textContent.trim()
    originalHtml = el.innerHTML
    box.follow(el)
    el.setAttribute('contenteditable', 'true')
    el.focus()
    api.panel.set('<div class="muted">Locating text in source…</div>')
    const found = await api.rpc('locate', { text: original })
    if (el !== target) return // selection moved on
    matches = found
    const where = !found.length
      ? '<div class="muted">Not found in editable source. Dynamic template expressions and computed text cannot be mapped safely.</div>'
      : found.map((m, i) => `
        <label class="row" style="align-items:flex-start;cursor:pointer">
          <input type="radio" name="loc" value="${i}" ${found.length === 1 ? 'checked' : ''} style="flex:none">
          <span><b style="display:inline;margin:0">${esc(m.file)}:${m.line}</b> <span class="muted">${m.kind}</span><br><span class="muted">${esc(m.snippet)}</span></span>
        </label>`).join('')
    api.panel.set(`<b>Edit text</b>
      <div class="muted" style="margin-bottom:6px">Edit on the page, then apply. Plain text, JSX entities, and inline bold/italic/underline/links are supported.${found.length > 1 ? ' Pick which source location to change:' : ''}</div>
      ${where}
      <div class="row" style="margin-top:6px"><button class="apply" ${found.length ? '' : 'disabled'}>Apply to source</button><button class="s reset">Reset</button></div>
      <div class="muted msg"></div>`)
    const p = api.panel.el, msg = p.querySelector('.msg')
    p.querySelector('.reset').onclick = () => { el.innerHTML = originalHtml; msg.textContent = 'Reset.' }
    p.querySelector('.apply').onclick = async () => {
      const to = el.textContent.trim()
      if (to === original) return (msg.textContent = 'Nothing changed.')
      const chosen = p.querySelector('input[name=loc]:checked')
      if (!chosen) return (msg.textContent = 'Pick a source location first.')
      const m = matches[Number(chosen.value)]
      try {
        const payload = { text: original, file: m.file, line: m.line, start: m.start }
        if (m.kind === 'jsx-rich') {
          await api.rpc('replace', { ...payload, html: el.innerHTML })
        } else {
          await api.rpc('replace', { ...payload, to })
        }
        msg.textContent = `Updated ${m.file}:${m.line}`
        stopEditing(false)
      } catch (err) { msg.textContent = 'Error: ' + err.message }
    }
  },

  deactivate() {
    stopEditing(true)
    box?.destroy()
  },
}
