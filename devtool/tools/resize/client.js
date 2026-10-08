// Resize tool: drag handles (or type values) to resize the selected element; Apply writes to CSS source.
// If the page's own min/max limits stop the size from changing, the matching limit is lifted too, so the
// element ends up exactly the size you dragged to.
const HANDLES = { nw: [0, 0], n: [.5, 0], ne: [1, 0], e: [1, .5], se: [1, 1], s: [.5, 1], sw: [0, 1], w: [0, .5] }
const PROPS = ['width', 'height', 'max-width', 'min-width', 'max-height', 'min-height']

let api, box, el, msgEl

const note = (t) => { if (msgEl) msgEl.textContent = t }
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]))

function syncApplyButton() {
  const button = api.panel.el.querySelector('.apply')
  button?.classList.toggle('ready', Object.keys(api.preview.decls(el)).length > 0)
}

/** Set width/height; if CSS limits (max-/min-) stop it, lift the limit so the result matches the request. */
function setSize(axis, px) {
  const [size, max, min] = axis === 'w' ? ['width', 'max-width', 'min-width'] : ['height', 'max-height', 'min-height']
  const measure = () => el.getBoundingClientRect()[size]
  api.preview.set(el, size, px + 'px')
  let lifted = ''
  let got = measure()
  if (Math.abs(got - px) > 1) {
    const cs = getComputedStyle(el)
    if (got < px && cs.getPropertyValue(max) !== 'none') { api.preview.set(el, max, px + 'px'); lifted = max }
    else if (got > px && !['0px', 'auto'].includes(cs.getPropertyValue(min))) { api.preview.set(el, min, px + 'px'); lifted = min }
    got = measure()
  }
  if (lifted) note(`${lifted} was limiting ${size}; set it too.`)
  else if (Math.abs(got - px) > 1) note(`Layout (flex/grid/parent) keeps ${size} at ~${Math.round(got)}px.`)
  else note('')
}

function sync() {
  if (!el) return
  box.refresh()
  const r = el.getBoundingClientRect()
  api.panel.el.querySelector('.w').value = el.style.width || Math.round(r.width) + 'px'
  api.panel.el.querySelector('.ht').value = el.style.height || Math.round(r.height) + 'px'
  syncApplyButton()
}

function startDrag(e, dir) {
  e.preventDefault(); e.stopPropagation()
  const r = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY
  const move = (ev) => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy
    if (dir.includes('e')) setSize('w', Math.max(10, Math.round(r.width + dx)))
    if (dir.includes('w')) setSize('w', Math.max(10, Math.round(r.width - dx)))
    if (dir.includes('s')) setSize('h', Math.max(10, Math.round(r.height + dy)))
    if (dir.includes('n')) setSize('h', Math.max(10, Math.round(r.height - dy)))
    sync()
  }
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up) }
  addEventListener('pointermove', move); addEventListener('pointerup', up)
}

export default {
  id: 'resize',
  name: 'Resize',
  hotkey: 'r',

  activate(a) {
    api = a
    box = api.box()
    for (const [dir, [x, y]] of Object.entries(HANDLES)) {
      const h = document.createElement('div')
      h.className = 'h'
      h.style.cssText = `left:calc(${x * 100}% - 5px);top:calc(${y * 100}% - 5px);cursor:${dir}-resize`
      h.addEventListener('pointerdown', (e) => startDrag(e, dir))
      box.el.appendChild(h)
    }
    api.panel.set('<div class="muted">Click an element to resize it.</div>')
  },

  onSelect(target) {
    api.preview.reset(el) // unapplied edits on the previous element are discarded
    el = target
    api.panel.set(`
      <b>${api.selectorFor(el)}</b>
      <div class="row"><label>width</label><input class="w"></div>
      <div class="row"><label>height</label><input class="ht"></div>
      <div class="row"><label>apply to</label><select class="scope">${api.selectorCandidates(el)
        .map(({ selector, label }) => `<option value="${esc(selector)}">${esc(label)}</option>`).join('')}</select></div>
      <div class="row"><button class="apply">Apply to CSS</button><button class="s reset">Reset</button></div>
      <div class="muted msg"></div>`)
    const p = api.panel.el
    msgEl = p.querySelector('.msg')
    for (const [cls, prop] of [['.w', 'width'], ['.ht', 'height']]) {
      p.querySelector(cls).addEventListener('change', (e) => {
        api.preview.set(el, prop, e.target.value)
        const px = parseFloat(getComputedStyle(el)[prop])
        if (e.target.value.endsWith('px')) setSize(prop === 'width' ? 'w' : 'h', parseFloat(e.target.value)); else if (px) note('')
        sync()
      })
    }
    p.querySelector('.reset').onclick = () => { api.preview.reset(el); sync(); note('Reset.') }
    p.querySelector('.apply').onclick = async () => {
      const decls = api.preview.decls(el)
      if (!Object.keys(decls).length) return note('Nothing changed.')
      try {
        const r = await api.rpc('apply', {
          selector: p.querySelector('.scope').value,
          decls,
          media: api.responsive.media,
        })
        const staged = api.preview.commit(el) // stylesheet owns it now
        syncApplyButton()
        const text = `${r.created ? 'Added rule to' : 'Updated'} ${r.file}${r.warning ? '. ' + r.warning : ''}`
        note(text)
        staged.then((off) => {
          if (off.length) note(`${text}. Warning: ${off.join(', ')} did not change on the page; a more specific rule wins. Pick a more specific scope.`)
        })
        setTimeout(sync, 150)
      } catch (err) { note('Error: ' + err.message) }
    }
    box.follow(el)
    sync()
  },

  deactivate() {
    api.preview.reset()
    box?.destroy()
    el = null
  },
}
