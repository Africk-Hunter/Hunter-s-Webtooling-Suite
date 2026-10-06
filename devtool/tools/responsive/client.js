const PRESETS = [
  { label: 'Mobile · 390px', width: 390, media: '(max-width: 767px)' },
  { label: 'Tablet · 800px', width: 800, media: '(min-width: 768px) and (max-width: 1023px)' },
  { label: 'Desktop · 1280px', width: 1280, media: null },
]

export default {
  id: 'responsive',
  name: 'Responsive',
  hotkey: 'v',

  activate(api) {
    api.panel.set(`<b>Responsive preview</b>
      <div class="muted" style="margin:4px 0 10px">Choose a real viewport width. Click an element in the preview, then switch to a style tool to edit it at this breakpoint.</div>
      <div class="responsive-presets">${PRESETS.map((preset) =>
        `<button class="s preset" data-width="${preset.width}" data-media="${preset.media ?? ''}">${preset.label}</button>`).join('')}
      </div>
      <div class="row"><button class="s exit-preview">Exit preview</button></div>`)
    const panel = api.panel.el
    panel.querySelectorAll('.preset').forEach((button) => {
      button.onclick = () => api.responsive.setViewport(Number(button.dataset.width), button.dataset.media || null)
    })
    panel.querySelector('.exit-preview').onclick = () => {
      api.responsive.close()
      api.panel.set('<b>Responsive preview</b><div class="muted">Preview closed.</div>')
    }
    api.responsive.setViewport(api.responsive.width || 1280, api.responsive.media)
  },
}
