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

let api, box, el, measures = {}
let fontTokens = [], sizeTokens = [], scaleRoot, tokenInline = {}

const GOOGLE_FONTS = [
  'DM Sans', 'Inter', 'Lato', 'Manrope', 'Merriweather', 'Montserrat',
  'Nunito', 'Open Sans', 'Oswald', 'Playfair Display', 'Poppins',
  'Roboto', 'Source Sans 3', 'Work Sans',
]

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

function scaleMarkup() {
  return `<details class="type-scale">
    <summary>Heading scale preview</summary>
    <div class="row"><label>base size</label><input class="scale-base" type="number" min="8" max="48" value="16"><span>px</span></div>
    <div class="row"><label>ratio</label><select class="scale-ratio"><option value="1.125">1.125 · Minor third</option><option value="1.2">1.2 · Minor third+</option><option value="1.25" selected>1.25 · Major third</option><option value="1.333">1.333 · Perfect fourth</option><option value="1.5">1.5 · Perfect fifth</option></select></div>
    <div class="scale-samples"></div>
  </details>`
}

function renderScalePreview() {
  const panel = api.panel.el
  const samples = panel.querySelector('.scale-samples')
  if (!samples) return
  const base = Math.min(48, Math.max(8, Number(panel.querySelector('.scale-base').value) || 16))
  const ratio = Number(panel.querySelector('.scale-ratio').value)
  samples.innerHTML = [1, 2, 3, 4, 5, 6].map((heading) => {
    const size = base * ratio ** (4 - heading)
    return `<div class="scale-sample"><small>H${heading} · ${size.toFixed(1)}px</small><span style="font-size:${size}px">A thoughtful type scale</span></div>`
  }).join('')
}

function tokenMarkup() {
  return `<details class="type-tokens">
    <summary>Site-wide font & size tokens</summary>
    <div class="muted">Changes preview across the page; Apply saves them in :root.</div>
    ${[...new Map([...fontTokens, ...sizeTokens].map((token) => [token.name, token])).values()]
      .map(({ name, value = '', kind }) => `<div class="row type-token-row" data-name="${esc(name)}">
        <label title="${esc(name)}">${esc(name)}</label>
        <input class="type-token" data-original="${esc(value)}" value="${esc(value)}" aria-label="${esc(name)}">
      </div>`).join('')}
    <div class="clamp-helper">
      <div class="muted">Create a fluid size token (px values)</div>
      <input class="clamp-name" placeholder="--size-heading">
      <div class="row"><input class="clamp-min" type="number" value="24" aria-label="Minimum size in pixels"><span>to</span><input class="clamp-max" type="number" value="48" aria-label="Maximum size in pixels"></div>
      <div class="row"><input class="clamp-vmin" type="number" value="360" aria-label="Minimum viewport width"><span>to</span><input class="clamp-vmax" type="number" value="1280" aria-label="Maximum viewport width"><span>px viewport</span></div>
      <button class="s make-clamp" type="button">Add clamp() token</button>
    </div>
    <div class="row"><button class="apply-tokens">Apply token changes</button></div>
    <div class="muted token-msg"></div>
  </details>`
}

function setupTypographyExtras(panel) {
  renderScalePreview()
  panel.querySelector('.scale-base').addEventListener('input', renderScalePreview)
  panel.querySelector('.scale-ratio').addEventListener('input', renderScalePreview)
  for (const input of panel.querySelectorAll('.type-token')) {
    const row = input.closest('.type-token-row')
    const name = row.dataset.name
    input.addEventListener('input', () => {
      api.preview.set(scaleRoot, name, input.value === input.dataset.original ? tokenInline[name] : input.value)
      panel.querySelector('.apply-tokens').classList.toggle('ready', Object.keys(api.preview.decls(scaleRoot)).length > 0)
    })
  }
  panel.querySelector('.make-clamp').onclick = () => {
    const name = panel.querySelector('.clamp-name').value.trim()
    const min = Number(panel.querySelector('.clamp-min').value)
    const max = Number(panel.querySelector('.clamp-max').value)
    const minViewport = Number(panel.querySelector('.clamp-vmin').value)
    const maxViewport = Number(panel.querySelector('.clamp-vmax').value)
    if (!/^--(?:font|size)-[\w-]+$/.test(name) || ![min, max, minViewport, maxViewport].every(Number.isFinite)
      || min < 1 || max <= min || minViewport < 240 || maxViewport <= minViewport || maxViewport > 3000) {
      panel.querySelector('.token-msg').textContent = 'Use a --font-* or --size-* token, increasing size values, and a valid viewport range.'
      return
    }
    const slope = (max - min) * 100 / (maxViewport - minViewport)
    const intercept = min - slope * minViewport / 100
    const preferred = `calc(${intercept.toFixed(3)}px + ${slope.toFixed(3)}vw)`
    const value = `clamp(${min}px, ${preferred}, ${max}px)`
    let input = [...panel.querySelectorAll('.type-token-row')].find((row) => row.dataset.name === name)?.querySelector('.type-token')
    if (!input) {
      const row = document.createElement('div')
      row.className = 'row type-token-row'
      row.dataset.name = name
      row.innerHTML = `<label title="${esc(name)}">${esc(name)}</label><input class="type-token" aria-label="${esc(name)}">`
      panel.querySelector('.clamp-helper').before(row)
      input = row.querySelector('.type-token')
      input.addEventListener('input', () => {
        api.preview.set(scaleRoot, name, input.value)
        panel.querySelector('.apply-tokens').classList.toggle('ready', Object.keys(api.preview.decls(scaleRoot)).length > 0)
      })
    }
    input.value = value
    input.dataset.original = ''
    api.preview.set(scaleRoot, name, value)
    panel.querySelector('.apply-tokens').classList.toggle('ready', true)
    panel.querySelector('.token-msg').textContent = `${name}: ${value}`
  }
  panel.querySelector('.apply-tokens').onclick = async () => {
    const values = api.preview.decls(scaleRoot)
    if (!Object.keys(values).length) return (panel.querySelector('.token-msg').textContent = 'Nothing changed.')
    try {
      const result = await api.rpc('applyTokens', { values })
      api.preview.commit(scaleRoot)
      for (const row of panel.querySelectorAll('.type-token-row')) {
        const input = row.querySelector('.type-token')
        input.dataset.original = input.value
        tokenInline[row.dataset.name] = scaleRoot.style.getPropertyValue(row.dataset.name)
      }
      panel.querySelector('.apply-tokens').classList.remove('ready')
      panel.querySelector('.token-msg').textContent = result.files.length
        ? `Updated token(s) in ${result.files.join(', ')}`
        : 'No token values changed.'
    } catch (error) {
      panel.querySelector('.token-msg').textContent = 'Error: ' + error.message
    }
  }
  panel.querySelector('.google-font-load').onclick = async () => {
    const family = panel.querySelector('.google-font').value
    if (!family) return
    const button = panel.querySelector('.google-font-load')
    button.disabled = true
    try {
      const result = await api.rpc('applyGoogleFont', {
        family,
        selector: panel.querySelector('.scope').value,
        media: api.responsive.media,
        decls: api.preview.decls(el),
      })
      api.preview.commit(el)
      panel.querySelector('.msg').textContent = result.unchanged
        ? `${family} was already loaded; applied typography to ${result.cssFile}.`
        : `Loaded ${family} and applied typography to ${result.file}.`
    } catch (error) {
      panel.querySelector('.msg').textContent = 'Error: ' + error.message
    } finally {
      button.disabled = false
    }
  }
}

const tool = {
  id: 'typography',
  name: 'Typography',
  hotkey: 't',

  async activate(a) {
    api = a
    box = api.box({ outline: '2px solid #bf5af2' })
    api.panel.set('<div class="muted">Click text to style it.</div>')
    try {
      const result = await api.rpc('tokens')
      fontTokens = result.fonts
      sizeTokens = result.sizes
    } catch {
      fontTokens = []
      sizeTokens = []
    }
  },

  onSelect(target) {
    api.preview.reset(el)
    api.preview.reset(scaleRoot)
    el = target
    box.follow(el)
    scaleRoot = el.ownerDocument.documentElement
    tokenInline = Object.fromEntries(
      [...fontTokens, ...sizeTokens].map(({ name }) => [name, scaleRoot.style.getPropertyValue(name)]),
    )
    const cs = getComputedStyle(el)
    const scopes = api.selectorCandidates(el)
    const fam = fontTokens.map(({ name }) => `<option value="var(${esc(name)})">${esc(name)}</option>`).join('')
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
      <div class="row"><label>Google font</label><select class="google-font" style="flex:1"><option value="">Choose family…</option>${GOOGLE_FONTS.map((font) => `<option>${esc(font)}</option>`).join('')}</select></div>
      <div class="row"><button class="s google-font-load" type="button">Load Google Font & preview</button></div>
      <div class="row"><label>apply to</label><select class="scope" style="flex:1">${scopes.map(({ selector, label }) => `<option value="${esc(selector)}">${esc(label)}</option>`).join('')}</select></div>
      ${tokenMarkup()}
      ${scaleMarkup()}
      <div class="row"><button class="apply">Apply to CSS</button><button class="s reset">Reset</button></div>
      <div class="muted msg"></div>`)
    const p = api.panel.el, msg = p.querySelector('.msg')
    setupTypographyExtras(p)
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
        const staged = api.preview.commit(el)
        syncApplyButton()
        const text = `${r.created ? 'Added rule to' : 'Updated'} ${r.file}${r.warning ? '. ' + r.warning : ''}`
        msg.textContent = text
        staged.then((off) => {
          if (off.length) msg.textContent = `${text}. Warning: ${off.join(', ')} did not change on the page; a more specific rule wins. Pick a more specific scope.`
        })
      } catch (err) { msg.textContent = 'Error: ' + err.message }
    }
  },

  deactivate() {
    api.preview.reset()
    box?.destroy()
    el = null
    scaleRoot = null
    tokenInline = {}
  },
}

export default tool
