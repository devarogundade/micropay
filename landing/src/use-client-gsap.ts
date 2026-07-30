import { useEffect, type DependencyList, type RefObject } from 'react'

type Gsap = typeof import('gsap').default
type ScrollTriggerType = typeof import('gsap/ScrollTrigger').ScrollTrigger

/**
 * Load GSAP (+ ScrollTrigger) only in the browser after mount.
 * `setup` may return a cleanup for non-GSAP resources (listeners, etc).
 */
export function useClientGsap(
  scope: RefObject<HTMLElement | null>,
  setup: (
    gsap: Gsap,
    ScrollTrigger: ScrollTriggerType,
  ) => void | (() => void),
  deps: DependencyList = [],
) {
  useEffect(() => {
    const el = scope.current
    if (!el) return

    let ctx: { revert: () => void } | undefined
    let extraCleanup: (() => void) | undefined
    let cancelled = false

    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ])
      if (cancelled) return

      gsap.registerPlugin(ScrollTrigger)

      const next = gsap.context(() => {
        const cleanup = setup(gsap, ScrollTrigger)
        if (typeof cleanup === 'function') extraCleanup = cleanup
      }, el)

      if (cancelled) {
        next.revert()
        extraCleanup?.()
        return
      }
      ctx = next
    })()

    return () => {
      cancelled = true
      ctx?.revert()
      extraCleanup?.()
    }
    // setup is intentionally omitted — callers pass mount-stable animation trees
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
