// SEO tool: edit the title, description and Open Graph tags in index.html, with length hints and previews.
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]))

const FIELDS = [
  ['title', 'title', 60],
  ['description', 'description', 160],
  ['canonical', 'canonical'],
  ['robots', 'robots'],
  ['og:title', 'og title', 60],
  ['og:description', 'og descr.', 200],
  ['og:image', 'og image'],
  ['og:url', 'og url'],
  ['og:type', 'og type'],
  ['twitter:card', 'tw card'],
]

/** Hints for a set of values. Exported for tests. */
export function seoHints(values) {
  const out = []
  if (!values.title) out.push('Missing <title>.')
  else if (values.title.length > 60) out.push(`Title is ${values.title.length} characters; search results cut off near 60.`)
  if (!values.description) out.push('Missing meta description.')
  else if (values.description.length > 160) out.push(`Description is ${values.description.length} characters; aim for 160 or fewer.`)
  else if (values.description.length < 50) out.push('Description is very short; aim for 70–160 characters.')
  if (!values['og:image']) out.push('No og:image; link shares will have no picture.')
  return out
}

export default {
  id: 'seo',
  name: 'SEO',
  hotkey: 'e',

  async activate(api) {
    api.panel.set('<div class="muted">Loading index.html…</div>')
    let original
    try {
      original = await api.rpc('read', {})
    } catch (error) {
      api.panel.set(`<div class="muted">Error: ${esc(error.message)}</div>`)
      return
    }
    api.panel.set(`<b>SEO · index.html</b>
      <div class="muted" style="margin:4px 0 8px">Applies site-wide (index.html). Empty a field to remove its tag.</div>
      ${FIELDS.map(([key, label, max]) => `<div class="row"><label for="seo-${esc(key)}">${label}</label>
        <input id="seo-${esc(key)}" data-key="${esc(key)}" value="${esc(original[key])}"></div>
        ${max ? `<div class="muted count" data-for="${esc(key)}" data-max="${max}" style="text-align:right;margin:-4px 0 4px"></div>` : ''}`).join('')}
      <div class="seo-preview scale-sample"></div>
      <div class="seo-hints muted"></div>
      <div class="row"><button class="apply">Apply to index.html</button><button class="s reset">Reset</button></div>
      <div class="muted msg"></div>`)
    const panel = api.panel.el
    const inputs = [...panel.querySelectorAll('input[data-key]')]
    const current = () => Object.fromEntries(inputs.map((input) => [input.dataset.key, input.value.trim()]))
    const refresh = () => {
      const values = current()
      panel.querySelectorAll('.count').forEach((count) => {
        const length = values[count.dataset.for].length
        count.textContent = `${length}/${count.dataset.max}`
        count.style.color = length > Number(count.dataset.max) ? '#fbbf24' : ''
      })
      panel.querySelector('.seo-preview').innerHTML = `<small>${esc(values.canonical || values['og:url'] || location.origin)}</small>
        <span style="color:#8ab4f8">${esc(values.title || '(no title)')}</span>
        <small style="white-space:normal">${esc(values.description || '')}</small>`
      panel.querySelector('.seo-hints').innerHTML = seoHints(values).map((hint) => `<div>⚠ ${esc(hint)}</div>`).join('')
    }
    inputs.forEach((input) => input.addEventListener('input', refresh))
    refresh()
    panel.querySelector('.reset').onclick = () => { inputs.forEach((input) => { input.value = original[input.dataset.key] }); refresh() }
    panel.querySelector('.apply').onclick = async () => {
      const values = current()
      const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== original[key]))
      const msg = panel.querySelector('.msg')
      if (!Object.keys(changed).length) return (msg.textContent = 'Nothing changed.')
      try {
        const result = await api.rpc('apply', { values: changed })
        Object.assign(original, changed)
        msg.textContent = `Updated ${result.file}`
      } catch (error) {
        msg.textContent = 'Error: ' + error.message
      }
    }
  },
}
