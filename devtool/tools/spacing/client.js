const SIDES = ['top', 'right', 'bottom', 'left']
const GROUPS = [
  ['margin', 'Margin'],
  ['padding', 'Padding'],
]
const LAYOUT_FIELDS = [
  ['display', 'display', ['block', 'flex', 'inline-flex', 'grid', 'inline-grid']],
  ['flex-direction', 'direction', ['row', 'row-reverse', 'column', 'column-reverse']],
  ['justify-content', 'justify', ['normal', 'start', 'end', 'center', 'space-between', 'space-around', 'space-evenly']],
  ['align-items', 'align items', ['normal', 'start', 'end', 'center', 'stretch', 'baseline']],
  ['align-content', 'align content', ['normal', 'start', 'end', 'center', 'stretch', 'space-between', 'space-around', 'space-evenly']],
  ['justify-items', 'justify items', ['normal', 'start', 'end', 'center', 'stretch']],
  ['align-self', 'align self', ['auto', 'start', 'end', 'center', 'stretch', 'baseline']],
  ['justify-self', 'justify self', ['auto', 'start', 'end', 'center', 'stretch']],
  ['flex-wrap', 'wrap', ['nowrap', 'wrap', 'wrap-reverse']],
  ['grid-auto-flow', 'grid flow', ['row', 'column', 'dense', 'row dense', 'column dense']],
  ['row-gap', 'row gap'],
  ['column-gap', 'column gap'],
  ['grid-template-columns', 'grid columns'],
  ['order', 'item order'],
]

let api, box, el, initial = {}

const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]))

function syncApplyButton() {
  const button = api.panel.el.querySelector('.apply')
  button?.classList.toggle('ready', Object.keys(api.preview.decls(el)).length > 0)
}

function restoreBase(prop) {
  api.preview.set(el, prop, initial[prop].inline)
}

function setValue(prop, value) {
  if (value === initial[prop].computed) restoreBase(prop)
  else api.preview.set(el, prop, value)
  syncApplyButton()
}

function bindDrag(button, input, prop) {
  if (!button) return
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    const match = input.value.trim().match(/^(-?(?:\d+\.?\d*|\.\d+))(px)?$/)
    if (!match) return
    const start = Number(match[1]), startY = event.clientY
    const move = (moveEvent) => {
      const value = Math.round((start + startY - moveEvent.clientY) * 100) / 100
      input.value = `${value}${match[2] || 'px'}`
      setValue(prop, input.value)
    }
    const up = () => {
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
    }
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
  })
}

function edgeMarkup(group, side, value) {
  const prop = `${group}-${side}`
  return `<div class="spacing-edge">
    <label for="spacing-${prop}">${side}</label>
    <input id="spacing-${prop}" data-prop="${prop}" value="${esc(value)}">
    <button class="s drag" type="button" aria-label="Drag ${prop}" title="Drag to adjust in pixels">↕</button>
  </div>`
}

function layoutFieldMarkup([prop, label, options], computedValue) {
  const control = options
    ? `<select data-prop="${prop}">
        ${[...new Set([computedValue, ...options])].map((value) =>
          `<option value="${esc(value)}" ${value === computedValue ? 'selected' : ''}>${esc(value)}</option>`).join('')}
      </select>`
    : `<input data-prop="${prop}" value="${esc(computedValue)}">`
  return `<div class="spacing-edge spacing-control">
    <label for="spacing-${prop}">${label}</label>
    ${control.replace(`data-prop="${prop}"`, `id="spacing-${prop}" data-prop="${prop}"`)}
  </div>`
}

export default {
  id: 'spacing',
  name: 'Spacing',
  hotkey: 's',

  activate(a) {
    api = a
    box = api.box()
    api.panel.set('<div class="muted">Click an element to edit its margin and padding.</div>')
  },

  onSelect(target) {
    api.preview.reset(el)
    el = target
    box.follow(el)
    const computed = getComputedStyle(el)
    initial = {}
    const properties = [
      ...GROUPS.flatMap(([group]) => SIDES.map((side) => `${group}-${side}`)),
      ...LAYOUT_FIELDS.map(([prop]) => prop),
    ]
    for (const prop of properties) {
      initial[prop] = { computed: computed.getPropertyValue(prop), inline: el.style.getPropertyValue(prop) }
    }
    api.panel.set(`<b>Spacing · ${esc(api.selectorFor(el))}</b>
      ${GROUPS.map(([group, title]) => `<div class="spacing-group">
        <div class="spacing-title">${title}</div>
        ${SIDES.map((side) => edgeMarkup(group, side, initial[`${group}-${side}`].computed)).join('')}
      </div>`).join('')}
      <details class="spacing-group">
        <summary class="spacing-title">Layout</summary>
        <div class="muted" style="margin-bottom:4px">Flex/grid settings for this element. Item order applies when its parent is flex or grid.</div>
        ${LAYOUT_FIELDS.map((field) => layoutFieldMarkup(field, initial[field[0]].computed)).join('')}
      </details>
      <div class="row"><label>apply to</label><select class="scope">${api.selectorCandidates(el)
        .map(({ selector, label }) => `<option value="${esc(selector)}">${esc(label)}</option>`).join('')}</select></div>
      <div class="row"><button class="apply">Apply to CSS</button><button class="s reset">Reset</button></div>
      <div class="muted msg"></div>`)
    const panel = api.panel.el
    panel.querySelectorAll('[data-prop]').forEach((input) => {
      const prop = input.dataset.prop
      input.addEventListener('input', () => setValue(prop, input.value.trim()))
      bindDrag(input.nextElementSibling, input, prop)
    })
    panel.querySelector('.reset').onclick = () => {
      api.preview.reset(el)
      this.onSelect(el)
      api.panel.el.querySelector('.msg').textContent = 'Reset.'
    }
    panel.querySelector('.apply').onclick = async () => {
      const decls = api.preview.decls(el)
      if (!Object.keys(decls).length) return (panel.querySelector('.msg').textContent = 'Nothing changed.')
      try {
        const result = await api.rpc('apply', {
          selector: panel.querySelector('.scope').value,
          decls,
          media: api.responsive.media,
        })
        const staged = api.preview.commit(el)
        syncApplyButton()
        const msg = panel.querySelector('.msg')
        const text = `${result.created ? 'Added rule to' : 'Updated'} ${result.file}${result.warning ? '. ' + result.warning : ''}`
        msg.textContent = text
        staged.then((off) => {
          if (off.length) msg.textContent = `${text}. Warning: ${off.join(', ')} did not change on the page; a more specific rule wins. Pick a more specific scope.`
        })
      } catch (error) {
        panel.querySelector('.msg').textContent = 'Error: ' + error.message
      }
    }
  },

  deactivate() {
    api.preview.reset()
    box?.destroy()
    el = null
  },
}
