// Inspect tool: shows computed size/spacing/font for the selected element and where its CSS lives.
let box

export default {
  id: 'inspect',
  name: 'Inspect',
  hotkey: 'i',

  activate(api) {
    box = api.box({ outline: '2px solid #34c759' })
    api.panel.set('<div class="muted">Click an element to inspect it.</div>')
  },

  async onSelect(el, api) {
    box.follow(el)
    const cs = getComputedStyle(el), r = el.getBoundingClientRect()
    const sel = api.selectorFor(el)
    const row = (k, v) => `<div class="row"><label>${k}</label><span>${v}</span></div>`
    api.panel.set(`<b>${sel}</b>
      ${row('size', `${Math.round(r.width)} × ${Math.round(r.height)}`)}
      ${row('margin', cs.margin)}${row('padding', cs.padding)}
      ${row('font', `${cs.fontSize} / ${cs.fontFamily.split(',')[0]}`)}
      ${row('color', cs.color)}${row('display', cs.display)}
      <div class="muted loc">locating…</div>`)
    try {
      const hits = await api.rpc('locate', { selector: sel })
      api.panel.el.querySelector('.loc').textContent = hits.length ? hits.join('  ') : 'no matching CSS found'
    } catch { /* panel may have changed */ }
  },

  deactivate() { box?.destroy() },
}
