import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'

export type CardBackId = 'standards' | 'vision' | 'howto'

export const BACK_COPY: Record<
  CardBackId,
  { eyebrow: string; title: string; body: string }
> = {
  standards: {
    eyebrow: 'NO SUBSCRIPTIONS',
    title: 'Wallet-native',
    body: 'Pay for the call. Then you\'re done.',
  },
  vision: {
    eyebrow: 'OUR FUTURE VISION',
    title: 'Usage, not seats',
    body: 'Pay-per-use as the default for AI.',
  },
  howto: {
    eyebrow: 'HOW IT WORKS',
    title: 'Connect · Pick · Pay',
    body: 'x402 settles each run in USDC.',
  },
}

export type PayCardHandle = {
  setRotateY: (deg: number) => void
}

type PayCardProps = {
  backId?: CardBackId
  className?: string
  interactive?: boolean
  size?: 'default' | 'large'
}

/** Single 3D pay card with pointer spring physics. */
export const PayCard = forwardRef<PayCardHandle, PayCardProps>(
  function PayCard(
    {
      backId = 'standards',
      className = '',
      interactive = true,
      size = 'default',
    },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement>(null)
    const cardRef = useRef<HTMLDivElement>(null)
    const physicsRef = useRef<HTMLDivElement>(null)
    const rotateYRef = useRef(0)
    const back = BACK_COPY[backId]

    useImperativeHandle(ref, () => ({
      setRotateY: (deg: number) => {
        rotateYRef.current = deg
        if (cardRef.current) {
          cardRef.current.style.transform = `perspective(1400px) rotateY(${deg}deg)`
        }
      },
    }))

    useEffect(() => {
      if (cardRef.current) {
        cardRef.current.style.transform = `perspective(1400px) rotateY(${rotateYRef.current}deg)`
      }
    }, [backId])

    useEffect(() => {
      if (!interactive) return
      const root = rootRef.current
      const physics = physicsRef.current
      if (!root || !physics) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const state = { tx: 0, ty: 0, cx: 0, cy: 0, vx: 0, vy: 0 }
      let raf = 0
      let hovering = false

      const onMove = (e: PointerEvent) => {
        const rect = root.getBoundingClientRect()
        const nx = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
        const ny = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1
        state.tx = Math.max(-1, Math.min(1, nx)) * 10
        state.ty = Math.max(-1, Math.min(1, ny)) * -8
        hovering = true
      }

      const onLeave = () => {
        state.tx = 0
        state.ty = 0
        hovering = false
      }

      const tick = () => {
        const ax = (state.tx - state.cx) * 0.14
        const ay = (state.ty - state.cy) * 0.14
        state.vx = (state.vx + ax) * 0.84
        state.vy = (state.vy + ay) * 0.84
        state.cx += state.vx
        state.cy += state.vy
        const t = performance.now()
        const idleX = hovering ? 0 : Math.sin(t / 1500) * 1.6
        const idleY = hovering ? 0 : Math.cos(t / 1700) * 1.2
        physics.style.transform = `rotateX(${state.cy + idleY}deg) rotateY(${state.cx + idleX}deg)`
        const gx = 48 + state.cx * 2.4
        const gy = 42 + state.cy * -2.4
        root.querySelectorAll<HTMLElement>('.pay-card-sheen').forEach((s) => {
          s.style.backgroundPosition = `${gx}% ${gy}%`
        })
        raf = requestAnimationFrame(tick)
      }

      root.addEventListener('pointermove', onMove)
      root.addEventListener('pointerleave', onLeave)
      raf = requestAnimationFrame(tick)
      return () => {
        cancelAnimationFrame(raf)
        root.removeEventListener('pointermove', onMove)
        root.removeEventListener('pointerleave', onLeave)
      }
    }, [interactive])

    return (
      <div
        ref={rootRef}
        className={`pay-card-wrap ${size === 'large' ? 'pay-card-wrap-lg' : ''} ${className}`}
        style={{ pointerEvents: interactive ? 'auto' : undefined }}
      >
        <div ref={physicsRef} className="pay-card-physics">
          <div ref={cardRef} className="pay-card tone-a" aria-hidden>
            <div className="pay-card-face pay-card-front">
              <div className="pay-card-sheen" />
              <div className="pay-card-noise" />
              <div className="relative z-10 flex h-full flex-col justify-between p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 bg-ink" />
                    <span className="text-sm font-semibold tracking-tight text-white lowercase">
                      micropay
                    </span>
                  </div>
                  <span className="font-pixel text-[10px] tracking-wider text-white/50">
                    USDC
                  </span>
                </div>
                <div className="mt-5 flex items-end gap-4">
                  <div className="pay-card-chip" />
                  <div className="pay-card-contactless" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="mt-auto">
                  <p className="font-pixel text-[11px] tracking-[0.18em] text-white/70">
                    PAY PER USE
                  </p>
                  <p className="mt-2 text-[clamp(1.1rem,2.2vw,1.35rem)] font-semibold tracking-tight text-white">
                    AI on Algorand
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <p className="font-mono text-[11px] tracking-[0.22em] text-white/50">
                      •••• 4020
                    </p>
                    <div className="flex items-center gap-2 opacity-80">
                      <img src="/assets/usdc.png" alt="" className="size-5" width={20} height={20} />
                      <img src="/assets/algorand.png" alt="" className="size-5 rounded" width={20} height={20} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pay-card-face pay-card-back">
              <div className="pay-card-sheen pay-card-sheen-soft" />
              <div className="pay-card-noise" />
              <div className="pay-card-back-inner">
                <div className="pay-card-stripe" />
                <div className="pay-card-sig flex items-center justify-between gap-2 px-2.5">
                  <span className="font-mono text-[9px] tracking-widest text-ink/60">
                    AUTHORIZED
                  </span>
                  <span className="font-pixel text-[9px] text-ink/80">x402</span>
                </div>
                <div className="pay-card-back-copy">
                  <p className="text-[9px] font-semibold tracking-[0.16em] text-white/55 uppercase">
                    {back.eyebrow}
                  </p>
                  <p className="mt-1 text-[clamp(1.05rem,2vw,1.3rem)] leading-tight font-semibold tracking-tight text-white">
                    {back.title}
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-white/85">
                    {back.body}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
)
