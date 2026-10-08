// Webtool client core: overlay shell, element picking, tool registry.
//
// A tool is a default-exported object:
//   {
//     id, name, hotkey?,            // hotkey: single key, used with Alt (e.g. 'r' => Alt+R)
//     activate(api),                // called when the tool is switched on
//     deactivate?(),                // called when switched off
//     onSelect?(el, api),           // a new element was selected while active
//     onClear?(),                   // selection cleared
//   }
//
// api (passed to activate/onSelect):
//   api.selected                    currently selected element (or null)
//   api.select(el)                  select an element
//   api.rpc(method, payload)        call this tool's server handler
//   api.panel                       { el, set(html|Node), clear() } — tool-owned panel area
//   api.box(opts)                   create a positioned overlay box { outline, fill } -> { follow(el), hide(), el }
//   api.selectorFor(el)             best-effort CSS selector for el
//   api.selectorCandidates(el)      unique-element and reusable class selectors
//   api.responsive                  { setViewport(width, media), media, width, close() }
//   api.preview                     { set(el, prop, value), decls(el), reset(el?), commit(el) } — staged inline edits;
//                                   commit drops the inline copies and returns a Promise of the props whose computed
//                                   value still differs after the stylesheet update (empty = the write took effect)
//   api.toast(text)
//   api.deactivate()                turn off the active tool
//   api.on(event, fn)               'scroll' | 'resize' | 'select' | 'write' ; returns off()
//                                   'write' fires when any rpc result contains { file } (a source write/undo)

const STYLE = `
*{box-sizing:border-box;font:12px/1.4 system-ui,sans-serif}
.bar{position:fixed;left:16px;bottom:16px;max-width:calc(100vw - 32px);background:#14161a;color:#e8eaed;border-radius:8px;padding:6px;
  display:none;gap:4px;overflow-x:auto;pointer-events:auto;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.bar button{flex:none;background:#23262c;color:inherit;border:0;border-radius:4px;padding:5px 10px;cursor:pointer;white-space:nowrap}
.bar button.on{background:#f59e0b}
.bar button:disabled{opacity:.5;cursor:default}
.bar button.layout-toggle{border-left:1px solid #3a3f47}
.bar button.layout-toggle.on{background:#3a3f47;color:#f59e0b}
.panel{position:fixed;right:16px;bottom:16px;width:280px;background:#14161a;color:#e8eaed;border-radius:8px;
  padding:12px;pointer-events:auto;display:none;max-height:80vh;overflow:auto;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.panel input{background:#23262c;color:inherit;border:1px solid #3a3f47;border-radius:4px;padding:4px 6px;min-width:0}
.panel select{background:#23262c;color:inherit;border:1px solid #3a3f47;border-radius:4px;padding:4px 6px;min-width:0}
.panel button{background:#f59e0b;color:#281804;border:0;border-radius:4px;padding:5px 10px;cursor:pointer}
.panel button.apply{background:#3a3f47;color:inherit}
.panel button.apply.ready{background:#f59e0b;color:#281804}
.panel button.s{background:#3a3f47}
.panel button:disabled{opacity:.5;cursor:default}
.panel .row{display:flex;gap:6px;align-items:center;margin-bottom:6px}
.panel .row label{width:56px;color:#9aa0a6}
.panel .row input{flex:1}
.panel .muted{color:#9aa0a6}
.panel .typography-measure{display:flex;align-items:center;gap:3px;flex:1;min-width:0}
.panel .typography-measure input{width:0;flex:1}
.panel .typography-measure .unit{color:#9aa0a6}
.panel .typography-measure button{padding:2px 6px}
.panel .typography-measure .drag{cursor:ns-resize;touch-action:none}
.panel .type-scale,.panel .type-tokens{margin:8px 0;border-top:1px solid #3a3f47;padding-top:7px}
.panel .type-scale summary,.panel .type-tokens summary{cursor:pointer;color:#e8eaed;margin-bottom:5px}
.panel .scale-sample{padding:5px 0;border-bottom:1px solid #30343b}
.panel .scale-sample small{display:block;color:#9aa0a6;font-size:10px}
.panel .scale-sample span{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.panel .type-token-row{gap:4px}
.panel .type-token-row label{width:94px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.panel .type-token-row input{flex:1;width:0}
.panel .clamp-helper{margin:8px 0;padding:8px;background:#202329;border-radius:4px}
.panel .clamp-helper>input{width:100%;margin:5px 0}
.panel .clamp-helper .row{align-items:center}
.panel .clamp-helper .row input{min-width:0}
.panel .spacing-group{margin:8px 0}
.panel .spacing-title{margin-bottom:4px;color:#9aa0a6}
.panel .spacing-edge{display:flex;align-items:center;gap:4px;margin:3px 0}
.panel .spacing-edge label{width:82px;color:#9aa0a6}
.panel .spacing-edge input{flex:1;width:0}
.panel .spacing-control select,.panel .spacing-control input{flex:1;width:0}
.panel .spacing-edge button{padding:2px 7px;cursor:ns-resize;touch-action:none}
.panel .responsive-presets{display:grid;gap:6px;margin-bottom:10px}
:host(.responsive-open) .bar,:host(.vertical-menu) .bar{top:16px;right:auto;bottom:16px;left:12px;width:136px;max-width:none;flex-direction:column;align-items:stretch;overflow-x:hidden;overflow-y:auto}
:host(.responsive-open) .bar button,:host(.vertical-menu) .bar button{white-space:normal;text-align:left}
:host(.responsive-open) .bar button.layout-toggle,:host(.vertical-menu) .bar button.layout-toggle{border-top:1px solid #3a3f47;border-left:0}
:host(.responsive-open) .panel{top:16px;right:auto;bottom:16px;left:158px;width:280px;max-height:none}
.box{position:fixed;pointer-events:none;display:none}
.hover{position:fixed;pointer-events:none;display:none;outline:1px solid rgba(245,158,11,.9);outline-offset:-1px}
.hover .tag{position:absolute;left:0;background:#f59e0b;color:#281804;padding:1px 6px;border-radius:3px;white-space:nowrap;font-size:11px}
.box .h{position:absolute;width:10px;height:10px;background:#fff;border:2px solid #f59e0b;pointer-events:auto}
.toast{position:fixed;left:50%;top:16px;transform:translateX(-50%);background:#14161a;color:#e8eaed;
  padding:6px 12px;border-radius:6px;display:none;pointer-events:none}
`

import { selectorFor, selectorCandidates } from 'virtual:webtool/selectors'

export function boot(tools, { token = '' } = {}) {
  if (document.getElementById('__webtool_host')) return
  const host = document.createElement('div')
  host.id = '__webtool_host'
  // Vertical toolbar on the left is the default; a saved horizontal choice wins.
  let savedLayout = null
  try { savedLayout = localStorage.getItem('webtool:layout') } catch { /* storage unavailable */ }
  if (savedLayout !== 'horizontal') host.classList.add('vertical-menu')
  host.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647'
  const root = host.attachShadow({ mode: 'open' })
  root.innerHTML = `<style>${STYLE}</style><div class="bar"></div><div class="panel"></div><div class="toast"></div>`
  document.body.appendChild(host)
  const bar = root.querySelector('.bar'), panelEl = root.querySelector('.panel'), toastEl = root.querySelector('.toast')

  const listeners = { scroll: new Set(), resize: new Set(), select: new Set(), write: new Set() }
  const emit = (ev, ...a) => listeners[ev].forEach((fn) => fn(...a))
  addEventListener('scroll', () => emit('scroll'), true)
  addEventListener('resize', () => emit('resize'))

  let enabled = false, selected = null, current = null, toastTimer
  let previewFrame = null, previewWidth = null, previewMedia = null
  const isOurs = (el) => el === host || host.contains(el)


  const makeApi = (tool) => ({
    get selected() { return selected },
    select,
    selectorFor,
    selectorCandidates,
    root,
    responsive: {
      get media() { return previewMedia },
      get width() { return previewWidth },
      setViewport(width, media = null) {
        if (!Number.isInteger(width) || width < 240 || width > 1920) throw new Error('viewport width must be between 240 and 1920 pixels')
        previewWidth = width
        previewMedia = media
        host.classList.add('responsive-open')
        renderBar()
        if (!previewFrame) {
          previewFrame = document.createElement('iframe')
          previewFrame.title = 'Responsive preview'
          previewFrame.style.cssText = 'position:fixed;top:0;left:calc(50% + 220px);transform:translateX(-50%);height:100vh;border:0;background:white;z-index:2147483646;box-shadow:0 0 0 100vmax rgba(0,0,0,.35)'
          const frame = previewFrame
          frame.addEventListener('load', () => {
            if (previewFrame !== frame) return
            const frameDocument = frame.contentDocument
            if (!frameDocument) return
            frameDocument.addEventListener('click', (event) => {
              if (!enabled || !current || !frame.contentDocument) return
              event.preventDefault()
              event.stopPropagation()
              const target = pick(event, frameDocument)
              if (target && target !== frameDocument.body && target !== frameDocument.documentElement) select(target)
            }, true)
            frameDocument.addEventListener('mousemove', (event) => scheduleHover(event, frameDocument), true)
            frameDocument.addEventListener('scroll', () => emit('scroll'), true)
            frame.contentWindow.addEventListener('resize', () => emit('resize'))
          })
          document.body.appendChild(previewFrame)
          const url = new URL(location.href)
          url.searchParams.set('__webtool_preview', '1')
          previewFrame.src = url.href
        }
        previewFrame.style.width = width + 'px'
      },
      close() {
        previewFrame?.remove()
        previewFrame = null
        previewWidth = null
        previewMedia = null
        selected = null
        host.classList.remove('responsive-open')
        renderBar()
        hideHover()
      },
    },
    rpc: async (method, payload = {}) => {
      const res = await fetch(`/__webtool/rpc/${tool.id}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webtool-Token': token },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      if (data.result?.file) emit('write', data.result) // a source file changed
      return data.result
    },
    panel: {
      el: panelEl,
      set(content) {
        panelEl.replaceChildren()
        if (typeof content === 'string') panelEl.innerHTML = content
        else panelEl.append(content)
        panelEl.style.display = 'block'
      },
      clear() { panelEl.replaceChildren(); panelEl.style.display = 'none' },
    },
    box({ outline = '2px solid #f59e0b', fill = 'transparent' } = {}) {
      const el = document.createElement('div')
      el.className = 'box'
      el.style.outline = outline
      el.style.background = fill
      root.appendChild(el)
      let following = null
      const place = () => {
        if (!following) return
        const r = following.getBoundingClientRect()
        const frame = following.ownerDocument.defaultView.frameElement
        const frameRect = frame?.getBoundingClientRect()
        const left = r.left + (frameRect?.left ?? 0)
        const top = r.top + (frameRect?.top ?? 0)
        Object.assign(el.style, { display: 'block', left: left + 'px', top: top + 'px', width: r.width + 'px', height: r.height + 'px' })
      }
      const offs = [api_on('scroll', place), api_on('resize', place)]
      return {
        el,
        follow(target) { following = target; place() },
        refresh: place,
        hide() { following = null; el.style.display = 'none' },
        destroy() { offs.forEach((o) => o()); el.remove() },
      }
    },
    // Staged inline-style edits with rollback. Props are kebab-case CSS property names.
    preview: (() => {
      const orig = new Map() // el -> Map(prop -> original inline value)
      const props = (el) => orig.get(el) ?? orig.set(el, new Map()).get(el)
      return {
        set(el, prop, value) {
          const m = props(el)
          if (!m.has(prop)) m.set(prop, el.style.getPropertyValue(prop))
          el.style.setProperty(prop, value)
        },
        /** { prop: value } for everything currently staged on el */
        decls(el) {
          return Object.fromEntries([...(orig.get(el)?.entries() ?? [])]
            .filter(([p, v]) => el.style.getPropertyValue(p) !== v)
            .map(([p]) => [p, el.style.getPropertyValue(p)]))
        },
        /** Roll back staged edits (all elements if el omitted). */
        reset(el) {
          for (const e of el ? [el] : [...orig.keys()]) {
            for (const [p, v] of orig.get(e) ?? []) v ? e.style.setProperty(p, v) : e.style.removeProperty(p)
            orig.delete(e)
          }
        },
        /** Edits were saved to source: drop the inline copies, keep nothing. */
        commit(el) {
          const staged = [...(orig.get(el)?.keys() ?? [])]
          const view = el.ownerDocument.defaultView
          const expected = Object.fromEntries(staged.map((p) => [p, view.getComputedStyle(el).getPropertyValue(p)]))
          for (const p of staged) el.style.removeProperty(p)
          orig.delete(el)
          // Resolves with the props whose computed value still differs once the stylesheet update has landed
          // (a more specific rule is winning, or the written rule never matched this element).
          return new Promise((resolve) => {
            const started = Date.now()
            const check = () => {
              if (!el.isConnected) return resolve([])
              const computed = view.getComputedStyle(el)
              const off = staged.filter((p) => computed.getPropertyValue(p) !== expected[p])
              if (!off.length || Date.now() - started > 1500) return resolve(off)
              setTimeout(check, 150)
            }
            setTimeout(check, 150)
          })
        },
      }
    })(),
    toast(text) {
      toastEl.textContent = text
      toastEl.style.display = 'block'
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => (toastEl.style.display = 'none'), 2500)
    },
    deactivate() {
      if (current === tool) deactivate()
    },
    on: api_on,
  })
  function api_on(ev, fn) { listeners[ev].add(fn); return () => listeners[ev].delete(fn) }

  const apis = new Map(tools.map((t) => [t.id, makeApi(t)]))

  function select(el) {
    selected = el
    if (current) current.onSelect?.(el, apis.get(current.id))
    emit('select', el)
  }

  function activate(tool) {
    if (current === tool) return deactivate()
    deactivate()
    current = tool
    apis.get(tool.id).panel.clear()
    tool.activate(apis.get(tool.id))
    if (selected) tool.onSelect?.(selected, apis.get(tool.id))
    renderBar()
  }
  function deactivate() {
    if (!current) return
    current.deactivate?.()
    apis.get(current.id).panel.clear()
    current = null
    renderBar()
  }

  function renderBar() {
    const buttons = tools.map((t) => {
      const b = document.createElement('button')
      b.textContent = t.name + (t.hotkey ? ` (Alt+${t.hotkey.toUpperCase()})` : '')
      b.className = current === t ? 'on' : ''
      b.onclick = () => activate(t)
      return b
    })
    const layout = document.createElement('button')
    const vertical = host.classList.contains('responsive-open') || host.classList.contains('vertical-menu')
    layout.type = 'button'
    layout.className = `layout-toggle${vertical ? ' on' : ''}`
    layout.textContent = vertical ? '↕' : '↔'
    layout.title = host.classList.contains('responsive-open')
      ? 'Vertical toolbar is required for responsive preview'
      : host.classList.contains('vertical-menu')
        ? 'Switch to horizontal toolbar'
        : 'Switch to vertical toolbar'
    layout.setAttribute('aria-label', 'Toggle vertical toolbar')
    layout.setAttribute('aria-pressed', String(host.classList.contains('vertical-menu')))
    layout.disabled = host.classList.contains('responsive-open')
    layout.onclick = () => {
      host.classList.toggle('vertical-menu')
      try { localStorage.setItem('webtool:layout', host.classList.contains('vertical-menu') ? 'vertical' : 'horizontal') } catch { /* storage unavailable */ }
      renderBar()
    }
    buttons.push(layout)
    bar.replaceChildren(...buttons)
  }

  // Master toggle Alt+W; tool hotkeys Alt+<key> while enabled.
  addEventListener('keydown', (e) => {
    if (!e.altKey) return
    const key = e.key.toLowerCase()
    if (key === 'w') {
      enabled = !enabled
      bar.style.display = enabled ? 'flex' : 'none'
      if (!enabled) {
        deactivate()
        selected = null
        apis.get('responsive')?.responsive.close()
      } else {
        renderBar()
      }
      e.preventDefault()
    } else if (enabled) {
      const tool = tools.find((t) => t.hotkey === key)
      if (tool) { activate(tool); e.preventDefault() }
    }
  })

  // Shared picking: while a tool is active, clicks select elements instead of firing page handlers.
  const pick = (e, doc = document) => doc.elementsFromPoint(e.clientX, e.clientY).find((el) => !isOurs(el))
  // A drag that starts on our UI (resize handle) ends with a click on whatever is under the cursor;
  // without this guard that click would select the element underneath and revert the edit.
  let pressedOnUi = false
  addEventListener('pointerdown', (e) => { pressedOnUi = e.composedPath().includes(host) }, true)
  addEventListener('click', (e) => {
    if (enabled && pressedOnUi) {
      pressedOnUi = false
      if (!isOurs(e.target)) { e.preventDefault(); e.stopPropagation() } // drag ended over the page
      return
    }
    if (!enabled || !current || isOurs(e.target)) return
    e.preventDefault(); e.stopPropagation()
    const el = pick(e)
    if (el) select(el)
  }, true)

  // Hover highlight (shared, owned by core): thin outline + a small tag label.
  // Stays quiet over our own UI, while dragging, and on page-level wrappers.
  const hover = document.createElement('div')
  hover.className = 'hover'
  hover.innerHTML = '<span class="tag"></span>'
  root.appendChild(hover)
  const hoverTag = hover.firstChild
  let hoverEl = null, raf = 0, lastEvent = null, overUi = false
  const hideHover = () => { hoverEl = null; hover.style.display = 'none' }
  const placeHover = () => {
    if (!hoverEl || !hoverEl.isConnected) return hideHover()
    const r = hoverEl.getBoundingClientRect()
    const frame = hoverEl.ownerDocument.defaultView.frameElement
    const frameRect = frame?.getBoundingClientRect()
    const left = r.left + (frameRect?.left ?? 0)
    const top = r.top + (frameRect?.top ?? 0)
    Object.assign(hover.style, { display: 'block', left: left + 'px', top: top + 'px', width: r.width + 'px', height: r.height + 'px' })
    hoverTag.textContent = `${selectorFor(hoverEl)}  ${Math.round(r.width)}×${Math.round(r.height)}`
    hoverTag.style.top = r.top > 22 ? '-22px' : 'auto'
    hoverTag.style.bottom = r.top > 22 ? 'auto' : '-22px'
  }
  let hoverDocument = document
  const updateHover = () => {
    raf = 0
    const e = lastEvent
    if (!enabled || !current || !e || e.buttons || overUi) return hideHover()
    const target = pick(e, hoverDocument)
    if (!target || target === selected || target === hoverDocument.body || target === hoverDocument.documentElement) return hideHover()
    hoverEl = target
    placeHover()
  }
  const scheduleHover = (event, doc) => {
    lastEvent = event
    hoverDocument = doc
    overUi = doc === document && event.composedPath().includes(host)
    raf ||= requestAnimationFrame(updateHover)
  }
  addEventListener('mousemove', (e) => {
    scheduleHover(e, document)
  }, true)
  document.addEventListener('mouseleave', hideHover)
  api_on('scroll', placeHover)
  api_on('resize', placeHover)
  api_on('select', hideHover)

  window.__webtool = { tools, activate: (id) => activate(tools.find((t) => t.id === id)) }
}
