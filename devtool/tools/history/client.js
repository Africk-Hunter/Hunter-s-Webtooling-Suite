// History tool: every source write made by webtool, with diffs and undo (newest first).
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const time = (ts) => new Date(ts).toLocaleTimeString()

let api, offWrite

async function render() {
  const entries = await api.rpc('list')
  const p = api.panel
  p.set(`<b>History</b>
    <div class="list" style="max-height:50vh;overflow:auto">
      ${entries.length ? '' : '<div class="muted">No changes yet.</div>'}
      ${entries.map((e) => `
        <div class="entry" data-id="${esc(e.id)}" style="margin-bottom:8px;${e.undone ? 'opacity:.5' : ''}">
          <div>${esc(e.label)}</div>
          <div class="muted">${time(e.ts)} · ${esc(e.tool)} · ${esc(e.file)}${e.undone ? ' · undone' : ''}</div>
          <div class="row" style="margin-top:4px">
            <button class="s diff">Diff</button>
            ${e.undone ? '<button class="redo">Redo</button>' : '<button class="undo">Undo</button>'}
          </div>
          <pre class="d" style="display:none;margin:4px 0 0;white-space:pre-wrap;font:11px monospace;background:#0d0f12;padding:6px;border-radius:4px"></pre>
        </div>`).join('')}
    </div>
    <div class="row"><button class="s copy">Copy session summary</button></div>
    <div class="muted msg"></div>`)
  const el = p.el, msg = el.querySelector('.msg')
  el.querySelectorAll('.entry').forEach((row) => {
    const id = row.dataset.id, pre = row.querySelector('.d')
    row.querySelector('.diff').onclick = async () => {
      if (pre.style.display === 'block') return (pre.style.display = 'none')
      const text = await api.rpc('diff', { id })
      pre.innerHTML = text.split('\n').map((l) =>
        `<div style="color:${l[0] === '+' ? '#34c759' : l[0] === '-' ? '#ff6b6b' : '#9aa0a6'}">${esc(l) || ' '}</div>`).join('')
      pre.style.display = 'block'
    }
    const redo = row.querySelector('.redo')
    if (redo) redo.onclick = async () => {
      try {
        const r = await api.rpc('redo', { id })
        api.toast(`Redid change in ${r.file}`)
        render()
      } catch (err) { msg.textContent = 'Error: ' + err.message }
    }
    const undo = row.querySelector('.undo')
    if (undo) undo.onclick = async () => {
      try {
        const r = await api.rpc('undo', { id })
        api.toast(`Undid change in ${r.file}`)
        render()
      } catch (err) { msg.textContent = 'Error: ' + err.message }
    }
  })
  el.querySelector('.copy').onclick = async () => {
    const text = await api.rpc('summary')
    try { await navigator.clipboard.writeText(text); msg.textContent = 'Copied.' } catch { msg.textContent = text }
  }
}

export default {
  id: 'history',
  name: 'History',
  hotkey: 'h',

  activate(a) {
    api = a
    offWrite = api.on('write', () => render().catch(() => {}))
    render().catch((e) => api.panel.set(`<div class="muted">Error: ${esc(e.message)}</div>`))
  },

  deactivate() { offWrite?.() },
}
