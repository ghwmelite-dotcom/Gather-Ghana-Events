import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE = 'Gather Ghana Events'
const ORIGIN = 'https://gatherghana.events'
const DEFAULT_DESC =
  'Bespoke event planning and styling in Accra. Weddings, celebrations, and corporate events, designed with intention.'
const DEFAULT_OG =
  'https://images.unsplash.com/photo-1695281536457-01f9a07c575b?auto=format&fit=crop&w=1200&q=80'

function setMeta(selector, attr, value) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    const [, key, val] = selector.match(/\[(.+?)="(.+?)"\]/) || []
    if (key && val) el.setAttribute(key, val)
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Per-page document head. Sets title, description, canonical, and
 * OpenGraph/Twitter tags. Lightweight alternative to react-helmet.
 */
export default function Seo({ title, description = DEFAULT_DESC, image = DEFAULT_OG, noindex = false }) {
  const { pathname } = useLocation()
  const fullTitle = title ? `${title} — ${SITE}` : `${SITE} — Bespoke Event Planning in Accra`
  const url = ORIGIN + pathname

  useEffect(() => {
    document.title = fullTitle
    setMeta('meta[name="description"]', 'content', description)
    setMeta('meta[name="robots"]', 'content', noindex ? 'noindex,nofollow' : 'index,follow')
    setLink('canonical', url)

    setMeta('meta[property="og:type"]', 'content', 'website')
    setMeta('meta[property="og:site_name"]', 'content', SITE)
    setMeta('meta[property="og:title"]', 'content', fullTitle)
    setMeta('meta[property="og:description"]', 'content', description)
    setMeta('meta[property="og:image"]', 'content', image)
    setMeta('meta[property="og:url"]', 'content', url)

    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image')
    setMeta('meta[name="twitter:title"]', 'content', fullTitle)
    setMeta('meta[name="twitter:description"]', 'content', description)
    setMeta('meta[name="twitter:image"]', 'content', image)
  }, [fullTitle, description, image, url, noindex])

  return null
}
