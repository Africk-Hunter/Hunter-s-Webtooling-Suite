// Selector helpers shared by the overlay core (served as virtual:webtool/selectors) and tests.
// Pure DOM functions: no overlay state.

const BROAD = 25 // a scope matching more elements than this is flagged in the picker

export const selectorFor = (el) => {
  const root = el.getRootNode()
  const segmentFor = (node) => {
    if (node.id) return `#${CSS.escape(node.id)}`
    const classes = [...node.classList].map((c) => `.${CSS.escape(c)}`).join('')
    const base = node.tagName.toLowerCase() + classes
    const matchingSiblings = node.parentElement ? [...node.parentElement.children].filter((sibling) =>
      sibling.tagName === node.tagName && [...node.classList].every((c) => sibling.classList.contains(c))) : []
    if (matchingSiblings.length < 2) return base
    const sameType = [...node.parentElement.children].filter((sibling) => sibling.tagName === node.tagName)
    return `${base}:nth-of-type(${sameType.indexOf(node) + 1})`
  }
  const parts = []
  for (let node = el; node && node.nodeType === Node.ELEMENT_NODE; node = node.parentElement) {
    parts.unshift(segmentFor(node))
    const candidate = parts.join(' > ')
    if (root.querySelectorAll(candidate).length === 1) return candidate
  }
  return parts.join(' > ')
}

export const selectorCandidates = (el) => {
  const tag = el.tagName.toLowerCase()
  const own = [...el.classList].map((c) => `.${CSS.escape(c)}`).join('') || tag
  let parent = el.parentElement
  while (parent && !parent.classList.length && parent !== el.ownerDocument.body) parent = parent.parentElement
  const matchedRules = []
  const collectRules = (rules, view) => {
    for (const rule of rules) {
      if (rule.selectorText) {
        try {
          if (el.matches(rule.selectorText)) matchedRules.push(rule.selectorText)
        } catch (error) {
          if (error.name !== 'SyntaxError') throw error
        }
      } else if (rule.conditionText && rule.cssRules) {
        if (rule.type !== 4 || view.matchMedia(rule.conditionText).matches) collectRules(rule.cssRules, view)
      } else if (rule.cssRules) {
        collectRules(rule.cssRules, view)
      }
    }
  }
  for (const sheet of el.ownerDocument.styleSheets) {
    if (sheet.disabled) continue
    try { collectRules(sheet.cssRules, el.ownerDocument.defaultView) }
    catch (error) {
      if (error.name !== 'SecurityError') throw error
    }
  }
  const specificity = (selector) => {
    const branches = []
    let depth = 0, start = 0
    for (let index = 0; index < selector.length; index++) {
      if (selector[index] === '(') depth++
      else if (selector[index] === ')') depth--
      else if (selector[index] === ',' && depth === 0) {
        branches.push(selector.slice(start, index))
        start = index + 1
      }
    }
    branches.push(selector.slice(start))
    return branches.map((branch) => {
      const normalized = branch.replace(/:where\([^)]*\)/g, '')
      const ids = (normalized.match(/#[\w-]+/g) ?? []).length
      const classes = (normalized.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length
      const types = (normalized.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:{1,2}[\w-]+(?:\([^)]*\))?/g, '')
        .match(/(?:^|[\s>+~])([a-z][\w-]*)/gi) ?? []).length
      return [ids, classes, types]
    }).sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0]
  }
  // A bare `*` branch (resets like `*, ::before, ::after`) matches every element: editing it is never what a pick means.
  const universal = (selector) => /(?:^|,)\s*\*\s*(?:,|$)/.test(selector)
  const existing = [...new Set(matchedRules)]
    .filter((selector) => !universal(selector))
    .map((selector) => ({ selector, specificity: specificity(selector) }))
    .sort((a, b) => b.specificity[0] - a.specificity[0]
      || b.specificity[1] - a.specificity[1]
      || b.specificity[2] - a.specificity[2])
  const candidates = [
    { selector: selectorFor(el), label: 'This element only' },
    ...existing.map(({ selector, specificity: score }) => ({
      selector,
      label: `CSS rule (${score.join(', ')}): ${selector}`,
    })),
    ...(el.classList.length ? [{ selector: own, label: `All ${own}` }] : []),
    ...(parent?.classList.length ? [{
      selector: `${[...parent.classList].map((c) => `.${CSS.escape(c)}`).join(' ')} ${own}`,
      label: `Inside ${[...parent.classList].map((c) => `.${CSS.escape(c)}`).join(' ')}`,
    }] : []),
    { selector: tag, label: `Every <${tag}>` },
  ]
  const root = el.getRootNode()
  const countOf = (selector) => {
    try { return root.querySelectorAll(selector).length } catch { return null }
  }
  return [...new Map(candidates.map((candidate) => [candidate.selector, candidate])).values()].map((candidate) => {
    const matches = countOf(candidate.selector)
    if (matches === null || matches <= 1) return { ...candidate, matches }
    return { ...candidate, matches, label: `${candidate.label} (${matches} elements${matches > BROAD ? ', broad' : ''})` }
  })
}
