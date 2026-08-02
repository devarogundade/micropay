import { useEffect, type DependencyList, type RefObject } from 'react'

type Gsap = typeof import('gsap').default

/**
 * Load GSAP only in the browser after mount so static tooling never evaluates
 * gsap's ESM entry (which crashes under CJS interop).
 */
export function useClientGsap(
  scope: RefObject<HTMLElement | null>,
  setup: (gsap: Gsap) => void,
  deps: DependencyList = [],
  options?: { scrollTrigger?: boolean },
) {
  const withScrollTrigger = options?.scrollTrigger ?? false

  useEffect(() => {
    const el = scope.current
    if (!el) return

    let ctx: { revert: () => void } | undefined
    let cancelled = false

    void (async () => {
      const { default: gsap } = await import('gsap')
      if (withScrollTrigger) {
        const { default: ScrollTrigger } = await import('gsap/ScrollTrigger')
        if (cancelled) return
        gsap.registerPlugin(ScrollTrigger)
      } else if (cancelled) {
        return
      }

      const next = gsap.context(() => setup(gsap), el)
      if (cancelled) {
        next.revert()
        return
      }
      ctx = next
    })()

    return () => {
      cancelled = true
      ctx?.revert()
    }
    // setup is intentionally omitted — callers pass mount-stable animation trees
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
