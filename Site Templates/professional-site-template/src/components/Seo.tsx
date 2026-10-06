import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { pages, site } from '../config/site'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

// Updates document.head on navigation using the per-page entries in config/site.ts.
export default function Seo() {
  const { pathname } = useLocation()

  useEffect(() => {
    const key = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
    const seo = pages[key] ?? pages['/']
    const url = `${site.url}${key}`
    const image = `${site.url}${seo.image ?? site.ogImage}`

    document.title = seo.title
    upsertMeta('name', 'description', seo.description)
    upsertLink('canonical', url)

    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:site_name', site.name)
    upsertMeta('property', 'og:title', seo.title)
    upsertMeta('property', 'og:description', seo.description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:image', image)

    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', seo.title)
    upsertMeta('name', 'twitter:description', seo.description)
    upsertMeta('name', 'twitter:image', image)
  }, [pathname])

  return null
}
