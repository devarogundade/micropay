import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  DEFAULT_APP_ORIGIN,
  DEFAULT_CODE_ORIGIN,
  DEFAULT_SITE_ORIGIN,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
} from '@micropay/site-meta'
import { LandingPage } from './LandingPage'
import './styles.css'

const site =
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(
    /\/$/,
    '',
  ) || DEFAULT_SITE_ORIGIN
const app =
  (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(
    /\/$/,
    '',
  ) || DEFAULT_APP_ORIGIN
const code =
  (import.meta.env.VITE_PUBLIC_CODE_URL as string | undefined)?.replace(
    /\/$/,
    '',
  ) || DEFAULT_CODE_ORIGIN

const ogImage = `${site}/og.png`

document.title = `${SITE_NAME} — ${SITE_TAGLINE}`

const head = document.head
const meta = (attrs: Record<string, string>) => {
  const el = document.createElement('meta')
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  head.appendChild(el)
}
meta({ name: 'description', content: SITE_DESCRIPTION })
meta({ name: 'application-name', content: SITE_NAME })
meta({ property: 'og:type', content: 'website' })
meta({ property: 'og:site_name', content: SITE_NAME })
meta({ property: 'og:title', content: `${SITE_NAME} — ${SITE_TAGLINE}` })
meta({ property: 'og:description', content: SITE_DESCRIPTION })
meta({ property: 'og:url', content: `${site}/` })
meta({ property: 'og:image', content: ogImage })
meta({ name: 'twitter:card', content: 'summary_large_image' })
meta({ name: 'twitter:title', content: `${SITE_NAME} — ${SITE_TAGLINE}` })
meta({ name: 'twitter:description', content: SITE_DESCRIPTION })
meta({ name: 'twitter:image', content: ogImage })

const link = document.createElement('link')
link.rel = 'canonical'
link.href = `${site}/`
head.appendChild(link)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LandingPage appOrigin={app} codeOrigin={code} siteOrigin={site} />
  </StrictMode>,
)
