const MAX_ENTRIES = 500
const METHODS = ['log', 'info', 'warn', 'error', 'debug']
const esc = (value) => String(value).replace(/[&<>"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}[char]))

let api
let dock
let styles
let entries = []
let filterLevel = 'all'
let filterText = ''
let collapsed = false
let dockSide = 'bottom'
let consoleOriginals
let consoleWrappers
let onError
let onRejection

function emptyState(text) {
  const message = document.createElement('div')
  message.className = 'webtool-console-empty'
  message.textContent = text
  return message
}

function formatValue(value) {
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`
  if (typeof value === 'string') return value
  if (value === null || typeof value !== 'object') return String(value)

  try {
    const seen = new WeakSet()
    const json = JSON.stringify(value, (_key, current) => {
      if (typeof current === 'bigint') return `${current}n`
      if (current && typeof current === 'object') {
        if (seen.has(current)) return '[Circular]'
        seen.add(current)
      }
      return current
    }, 2)
    return json === undefined ? String(value) : json
  } catch {
    return '[Unserializable value]'
  }
}

function formatArgs(args) {
  return args.map(formatValue).join(' ')
}

function record(level, args) {
  const entry = {
    level,
    message: formatArgs(args),
    time: new Date(),
  }
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries.shift()
  renderEntries()
}

function button(text, className, title, onClick) {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = className
  element.textContent = text
  element.title = title
  element.setAttribute('aria-label', title)
  element.onclick = onClick
  return element
}

function makeEntry(entry) {
  const row = document.createElement('div')
  row.className = `webtool-console-entry level-${entry.level}`

  const time = document.createElement('time')
  time.textContent = entry.time.toLocaleTimeString()

  const level = document.createElement('strong')
  level.textContent = entry.level

  const message = document.createElement('pre')
  message.textContent = entry.message
  row.append(time, level, message)
  return row
}

function renderEntries() {
  if (!dock) return
  const list = dock.querySelector('.webtool-console-entries')
  const count = dock.querySelector('.webtool-console-count')
  const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 48
  const needle = filterText.trim().toLocaleLowerCase()
  const visible = entries.filter((entry) =>
    (filterLevel === 'all' || entry.level === filterLevel)
      && (!needle || `${entry.level} ${entry.message}`.toLocaleLowerCase().includes(needle)))

  count.textContent = String(entries.length)
  list.replaceChildren(...(visible.length
    ? visible.map(makeEntry)
    : [emptyState(entries.length ? 'No entries match these filters.' : 'No console output captured yet.')]))
  if (wasAtBottom) list.scrollTop = list.scrollHeight
}

function setDockSide(side) {
  dockSide = side
  dock.dataset.dock = side
  dock.querySelectorAll('.webtool-console-dock-button').forEach((buttonEl) => {
    const selected = buttonEl.dataset.side === side
    buttonEl.classList.toggle('selected', selected)
    buttonEl.setAttribute('aria-pressed', String(selected))
  })
}

function setCollapsed(value) {
  collapsed = value
  dock.classList.toggle('collapsed', collapsed)
  const toggle = dock.querySelector('.webtool-console-collapse')
  toggle.textContent = collapsed ? '□' : '—'
  toggle.title = collapsed ? 'Expand console' : 'Collapse console'
  toggle.setAttribute('aria-label', toggle.title)
  toggle.setAttribute('aria-expanded', String(!collapsed))
}

function createPanel() {
  styles = document.createElement('style')
  styles.textContent = `
    .webtool-console-dock{position:fixed;z-index:1;display:flex;flex-direction:column;overflow:hidden;
      background:#14161a;color:#e8eaed;border:1px solid #3a3f47;border-radius:8px;
      box-shadow:0 8px 24px rgba(0,0,0,.45);pointer-events:auto}
    .webtool-console-dock[data-dock="top"],.webtool-console-dock[data-dock="bottom"]{
      left:12px;right:12px;height:min(42vh,360px);min-height:180px}
    .webtool-console-dock[data-dock="top"]{top:12px}
    .webtool-console-dock[data-dock="bottom"]{bottom:12px}
    .webtool-console-dock[data-dock="left"],.webtool-console-dock[data-dock="right"]{
      top:12px;bottom:12px;width:min(520px,calc(100vw - 24px))}
    .webtool-console-dock[data-dock="left"]{left:12px}
    .webtool-console-dock[data-dock="right"]{right:12px}
    .webtool-console-head{display:flex;align-items:center;justify-content:space-between;gap:10px;
      min-height:40px;padding:6px 10px;background:#202329;border-bottom:1px solid #3a3f47}
    .webtool-console-title{display:flex;align-items:center;gap:8px;font-weight:700}
    .webtool-console-count{min-width:20px;padding:1px 5px;border-radius:10px;background:#3a3f47;
      color:#e8eaed;text-align:center;font-size:10px}
    .webtool-console-actions{display:flex;align-items:center;gap:4px}
    .webtool-console-dock button{border:0;border-radius:4px;background:#3a3f47;color:#e8eaed;
      padding:4px 7px;cursor:pointer}
    .webtool-console-dock button:hover,.webtool-console-dock button.selected{background:#527b63;color:#fff}
    .webtool-console-dock button.webtool-console-close{background:#3d3032}
    .webtool-console-dock button.webtool-console-close:hover{background:#8f3b3b;color:#fff}
    .webtool-console-filters{display:flex;gap:6px;padding:7px 10px;border-bottom:1px solid #30343b}
    .webtool-console-filters select,.webtool-console-filters input{min-width:0;background:#23262c;color:inherit;
      border:1px solid #3a3f47;border-radius:4px;padding:5px 7px}
    .webtool-console-filters select{width:96px}
    .webtool-console-filters input{flex:1}
    .webtool-console-entries{flex:1;overflow:auto;font:11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}
    .webtool-console-entry{display:grid;grid-template-columns:72px 48px minmax(0,1fr);gap:8px;
      padding:5px 10px;border-bottom:1px solid #24272d}
    .webtool-console-entry time{color:#8b929c}
    .webtool-console-entry strong{text-transform:uppercase;color:#bbc2cb;font-size:10px}
    .webtool-console-entry pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}
    .webtool-console-entry.level-warn strong{color:#f2c46d}
    .webtool-console-entry.level-error strong,.webtool-console-entry.level-assert strong{color:#ff7b72}
    .webtool-console-entry.level-info strong{color:#8ab4f8}
    .webtool-console-empty{padding:12px;color:#9aa0a6}
    .webtool-console-dock.collapsed[data-dock="top"],.webtool-console-dock.collapsed[data-dock="bottom"]{
      height:42px;min-height:0}
    .webtool-console-dock.collapsed[data-dock="left"],.webtool-console-dock.collapsed[data-dock="right"]{
      width:42px;min-width:0}
    .webtool-console-dock.collapsed .webtool-console-filters,
    .webtool-console-dock.collapsed .webtool-console-entries,
    .webtool-console-dock.collapsed .webtool-console-dock-button,
    .webtool-console-dock.collapsed .webtool-console-clear,
    .webtool-console-dock.collapsed .webtool-console-count{display:none}
    .webtool-console-dock.collapsed .webtool-console-close{font-size:0}
    .webtool-console-dock.collapsed .webtool-console-close::after{content:'×';font-size:16px}
    .webtool-console-dock.collapsed .webtool-console-head{flex:1;justify-content:center;padding:4px}
    .webtool-console-dock.collapsed[data-dock="left"] .webtool-console-title,
    .webtool-console-dock.collapsed[data-dock="right"] .webtool-console-title{
      writing-mode:vertical-rl}
    .webtool-console-dock.collapsed[data-dock="left"] .webtool-console-actions,
    .webtool-console-dock.collapsed[data-dock="right"] .webtool-console-actions{flex-direction:column}
    @media(max-width:520px){
      .webtool-console-dock[data-dock="left"],.webtool-console-dock[data-dock="right"]{width:calc(100vw - 24px)}
      .webtool-console-dock[data-dock="left"] .webtool-console-head,
      .webtool-console-dock[data-dock="right"] .webtool-console-head{align-items:flex-start}
      .webtool-console-entry{grid-template-columns:58px 42px minmax(0,1fr);gap:5px;padding:5px 7px}
    }
  `

  dock = document.createElement('section')
  dock.className = 'webtool-console-dock'
  dock.setAttribute('aria-label', 'Developer console')
  const head = document.createElement('header')
  head.className = 'webtool-console-head'
  const title = document.createElement('div')
  title.className = 'webtool-console-title'
  title.append('Console')
  const count = document.createElement('span')
  count.className = 'webtool-console-count'
  count.setAttribute('aria-label', 'Console entry count')
  title.append(count)

  const actions = document.createElement('div')
  actions.className = 'webtool-console-actions'
  for (const [side, label] of [['top', 'T'], ['right', 'R'], ['bottom', 'B'], ['left', 'L']]) {
    const dockButton = button(label, 'webtool-console-dock-button', `Dock console ${side}`, () => setDockSide(side))
    dockButton.dataset.side = side
    actions.append(dockButton)
  }
  actions.append(
    button('Clear', 'webtool-console-clear', 'Clear console entries', () => {
      entries = []
      renderEntries()
    }),
    button('—', 'webtool-console-collapse', 'Collapse console', () => setCollapsed(!collapsed)),
    button('Close', 'webtool-console-close', 'Close console and return to the page', () => api.deactivate()),
  )
  head.append(title, actions)

  const filters = document.createElement('div')
  filters.className = 'webtool-console-filters'
  const levelFilter = document.createElement('select')
  levelFilter.setAttribute('aria-label', 'Filter console entries by level')
  for (const value of ['all', 'log', 'info', 'warn', 'error', 'debug', 'assert']) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = value === 'all' ? 'All levels' : value
    levelFilter.append(option)
  }
  levelFilter.value = filterLevel
  levelFilter.onchange = () => {
    filterLevel = levelFilter.value
    renderEntries()
  }

  const search = document.createElement('input')
  search.type = 'search'
  search.placeholder = 'Filter messages'
  search.setAttribute('aria-label', 'Filter console messages')
  search.value = filterText
  search.oninput = () => {
    filterText = search.value
    renderEntries()
  }
  filters.append(levelFilter, search)

  const list = document.createElement('div')
  list.className = 'webtool-console-entries'
  list.setAttribute('role', 'log')
  list.setAttribute('aria-live', 'polite')
  dock.append(head, filters, list)
  api.root.append(styles, dock)
  setDockSide(dockSide)
  setCollapsed(collapsed)
  renderEntries()
}

function captureConsole() {
  consoleOriginals = {}
  consoleWrappers = {}
  for (const method of METHODS) {
    const original = console[method]
    consoleOriginals[method] = original
    const wrapper = function (...args) {
      record(method, args)
      return original.apply(this, args)
    }
    consoleWrappers[method] = wrapper
    console[method] = wrapper
  }

  consoleOriginals.assert = console.assert
  consoleWrappers.assert = function (condition, ...args) {
    if (!condition) record('assert', args.length ? args : ['Assertion failed'])
    return consoleOriginals.assert.apply(this, [condition, ...args])
  }
  console.assert = consoleWrappers.assert

  consoleOriginals.clear = console.clear
  consoleWrappers.clear = function (...args) {
    entries = []
    renderEntries()
    return consoleOriginals.clear.apply(this, args)
  }
  console.clear = consoleWrappers.clear

  onError = (event) => {
    const details = event.error ? formatValue(event.error) : event.message
    record('error', [`${details}${event.filename ? ` at ${event.filename}:${event.lineno}:${event.colno}` : ''}`])
  }
  onRejection = (event) => record('error', ['Unhandled promise rejection:', event.reason])
  addEventListener('error', onError)
  addEventListener('unhandledrejection', onRejection)
}

function restoreConsole() {
  for (const method of [...METHODS, 'assert', 'clear']) {
    if (console[method] === consoleWrappers[method]) console[method] = consoleOriginals[method]
  }
  removeEventListener('error', onError)
  removeEventListener('unhandledrejection', onRejection)
  consoleOriginals = null
  consoleWrappers = null
  onError = null
  onRejection = null
}

export default {
  id: 'devconsole',
  name: 'DevConsole',
  hotkey: 'd',

  activate(a) {
    api = a
    createPanel()
    captureConsole()
  },

  deactivate() {
    restoreConsole()
    dock?.remove()
    styles?.remove()
    dock = null
    styles = null
    api = null
  },
}
