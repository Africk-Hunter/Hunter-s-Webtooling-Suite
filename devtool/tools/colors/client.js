const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]))

function colorValue(value) {
  const hex = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) return hex[1].length === 3 ? '#' + [...hex[1]].map((n) => n + n).join('') : value
  const rgb = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  return rgb ? '#' + rgb.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('') : '#000000'
}

let api, root, originalInline

function renderTokens(tokens) {
  originalInline = new Map(tokens.map(({ name }) => [name, root.style.getPropertyValue(name)]))
  api.panel.set(`<b>Color tokens</b>
    <div class="muted" style="margin:4px 0 10px">Edit a shared --color-* variable and apply it across the site.</div>
    ${tokens.length ? tokens.map(({ name, value }) => `<div class="row token-row" data-name="${esc(name)}">
      <label title="${esc(name)}">${esc(name.replace('--color-', ''))}</label>
      <input type="color" class="token-color" data-original="${colorValue(value)}" value="${colorValue(value)}" aria-label="Choose ${esc(name)}">
    </div>`).join('') : '<div class="muted">No --color-* tokens found in :root.</div>'}
    <div class="row"><button class="apply">Apply color changes</button></div>
    <div class="muted msg"></div>`)
  const panel = api.panel.el
  panel.querySelectorAll('.token-row').forEach((row) => {
    const name = row.dataset.name
    const input = row.querySelector('.token-color')
    input.oninput = () => {
      api.preview.set(root, name, input.value === input.dataset.original ? originalInline.get(name) : input.value)
      updateApplyButton()
    }
  })
  panel.querySelector('.apply').onclick = async () => {
    const values = api.preview.decls(root)
    if (!Object.keys(values).length) return (panel.querySelector('.msg').textContent = 'Nothing changed.')
    try {
      const result = await api.rpc('apply', { values })
      api.preview.commit(root)
      panel.querySelector('.msg').textContent = `Updated ${Object.keys(values).length} color token(s) in ${result.file}`
      renderTokens(await api.rpc('tokens'))
    } catch (error) {
      panel.querySelector('.msg').textContent = 'Error: ' + error.message
    }
  }
}

function updateApplyButton() {
  const button = api.panel.el.querySelector('.apply')
  button?.classList.toggle('ready', Object.keys(api.preview.decls(root)).length > 0)
}

export default {
  id: 'colors',
  name: 'Colors',
  hotkey: 'k',

  async activate(a) {
    api = a
    root = api.selected?.ownerDocument.documentElement ?? document.documentElement
    api.preview.reset(root)
    try {
      renderTokens(await api.rpc('tokens'))
    } catch (error) {
      api.panel.set(`<div class="muted">Error loading color tokens: ${esc(error.message)}</div>`)
    }
  },

  deactivate() {
    api.preview.reset(root)
    originalInline = null
    root = null
  },
}
