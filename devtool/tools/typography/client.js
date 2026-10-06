// Typography tool: live-edit text styling on the selected element, then write it to the CSS rule you choose.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// [css prop, label, kind, options]
const FIELDS = [
  ['font-size', 'size', 'measure'],
  ['font-weight', 'weight', 'select', ['100', '200', '300', '400', '500', '600', '700', '800', '900']],
  ['line-height', 'leading', 'measure'],
  ['letter-spacing', 'tracking', 'measure'],
  ['text-align', 'align', 'select', ['left', 'center', 'right', 'justify']],
  ['text-transform', 'case', 'select', ['none', 'uppercase', 'lowercase', 'capitalize']],
  ['color', 'color', 'color'],
]

const rgbToHex = (rgb) => {
  const m = rgb.match(/\d+(\.\d+)?/g)
  return m ? '#' + m.slice(0, 3).map((n) => Math.round(+n).toString(16).padStart(2, '0')).join('') : '#000000'
}

let api, box, el, tokens = [], measures = {}

function measureValue(prop, value) {
  const match = String(value).trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(px|rem|em|%)?$/)
  if (match) return { value: Number(match[1]), unit: match[2] || 'px' }
  if (prop === 'letter-spacing') return { value: 0, unit: 'px' }
  if (prop === 'line-height') return { value: Number.parseFloat(getComputedStyle(el).fontSize) * 1.2, unit: 'px' }
  return { value: Number.parseFloat(getComputedStyle(el).fontSize), unit: 'px' }
}

function setMeasure(prop, value) {
  const field = measures[prop]
  const rounded = Math.round(value * 100) / 100
  const input = api.panel.el.querySelector(`[data-p="${prop}"]`)
  input.value = String(rounded)
  if (rounded === field.value) api.preview.set(el, prop, field.inline)
  else api.preview.set(el, prop, `${rounded}${field.unit}`)
  box.refresh()
  syncApplyButton()
}

function measureControl(prop, computedValue) {
  const measure = measureValue(prop, computedValue)
  measures[prop] = { ...measure, inline: el.style.getPropertyValue(prop) }
  const step = prop === 'letter-spacing' ? 0.1 : 1
  return `<div class="typography-measure">
    <input data-p="${prop}" type="number" step="${step}" value="${measure.value}">
    <span class="unit">${measure.unit}</span>
    <button class="s step" type="button" data-step="-${step}" aria-label="Decrease ${prop}">−</button>
    <button class="s step" type="button" data-step="${step}" aria-label="Increase ${prop}">+</button>
    <button class="s drag" type="button" aria-label="Drag ${prop}" title="Drag up or down to adjust">↕</button>
  </div>`
}

function syncApplyButton() {
  const button = api.panel.el.querySelector('.apply')
  button?.classList.toggle('ready', Object.keys(api.preview.decls(el)).length > 0)
}

const tool = {
  id: 'typography',
  name: 'Typography',
  hotkey: 't',

  async activate(a) {
    api = a
    box = api.box({ outline: '2px solid #bf5af2' })
    api.panel.set('<div class="muted">Click text to style it.</div>')
    try { tokens = await api.rpc('tokens') } catch { tokens = [] }
  },

  onSelect(target) {
    api.preview.reset(el)
    el = target
    box.follow(el)
    const cs = getComputedStyle(el)
    const scopes = api.selectorCandidates(el)
    const fam = tokens.map((t) => `<option value="var(${t})">${t}</option>`).join('')
    measures = {}
    api.panel.set(`<b>Typography</b>
      <div class="muted" style="margin-bottom:6px">${esc(cs.fontFamily.split(',')[0])}</div>
      ${FIELDS.map(([prop, label, kind, opts]) => `<div class="row"><label>${label}</label>${
        kind === 'select'
          ? `<select data-p="${prop}" style="flex:1">${opts.map((o) => `<option ${cs[prop] === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`
          : kind === 'measure'
            ? measureControl(prop, cs.getPropertyValue(prop))
          : `<input data-p="${prop}" type="${kind === 'color' ? 'color' : 'text'}" value="${esc(kind === 'color' ? rgbToHex(cs.color) : cs[prop])}">`
      }</div>`).join('')}
      <div class="row"><label>font</label><select data-p="font-family" style="flex:1"><option value="">(unchanged)</option>${fam}</select></div>
      <div class="row"><label>apply to</label><select class="scope" style="flex:1">${scopes.map(({ selector, label }) => `<option value="${esc(selector)}">${esc(label)}</option>`).join('')}</select></div>
      <div class="row"><button class="apply">Apply to CSS</button><button class="s reset">Reset</button></div>
      <div class="muted msg"></div>`)
    const p = api.panel.el, msg = p.querySelector('.msg')
    p.querySelectorAll('[data-p]').forEach((input) => {
      const prop = input.dataset.p
      const initial = input.value
      if (measures[prop]) {
        input.addEventListener('input', () => {
          const value = Number(input.value)
          if (Number.isFinite(value)) setMeasure(prop, value)
        })
        const controls = input.parentElement
        controls.querySelectorAll('.step').forEach((button) => {
          button.onclick = () => setMeasure(prop, Number(input.value || 0) + Number(button.dataset.step))
        })
        const drag = controls.querySelector('.drag')
        drag.addEventListener('pointerdown', (event) => {
          event.preventDefault()
          const start = Number(input.value || 0), startY = event.clientY
          const move = (moveEvent) => setMeasure(prop, start + startY - moveEvent.clientY)
          const up = () => {
            removeEventListener('pointermove', move)
            removeEventListener('pointerup', up)
          }
          addEventListener('pointermove', move)
          addEventListener('pointerup', up)
        })
        return
      }
      input.addEventListener(input.tagName === 'SELECT' || input.type === 'color' ? 'input' : 'change', () => {
        if (input.value === initial && !api.preview.decls(el)[prop]) return
        if (input.value) api.preview.set(el, prop, input.value)
        box.refresh()
        syncApplyButton()
      })
    })
    p.querySelector('.reset').onclick = () => { api.preview.reset(el); box.refresh(); msg.textContent = 'Reset.'; tool.onSelect(el) }
    p.querySelector('.apply').onclick = async () => {
      const decls = api.preview.decls(el)
      if (!Object.keys(decls).length) return (msg.textContent = 'Nothing changed.')
      try {
        const r = await api.rpc('apply', {
          selector: p.querySelector('.scope').value,
          decls,
          media: api.responsive.media,
        })
        api.preview.commit(el)
        syncApplyButton()
        msg.textContent = `${r.created ? 'Added rule to' : 'Updated'} ${r.file}`
      } catch (err) { msg.textContent = 'Error: ' + err.message }
    }
  },

  deactivate() {
    api.preview.reset()
    box?.destroy()
    el = null
  },
}

export default tool
