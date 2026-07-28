import { useEffect, useState } from 'react'

/** Tailwind `lg` breakpoint (min-width: 1024px). */
export const LG_MEDIA_QUERY = '(min-width: 1024px)'

/**
 * Subscribe to a CSS media query. Returns `null` until mounted so SSR and the
 * first client paint stay aligned (caller can render a neutral placeholder).
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
