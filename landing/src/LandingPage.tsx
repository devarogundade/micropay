import { useCallback, useRef, useState, type MouseEvent } from 'react';

import { FaqSection } from './FaqSection';
import { PixelAccent } from './HeroGeometry';
import { PayCard, type CardBackId, type PayCardHandle } from './PayCard';
import { useClientGsap } from './use-client-gsap';

const PRODUCTS = [
  {
    id: 'chat',
    label: 'CHAT',
    title: 'Pay-per-message chat',
    body: 'Ask anything across popular models. Each completion settles in USDC via x402 — no API keys, no subscription.',
    side: 'Lite models start around $0.01 USDC. Activity shows every settlement on Algorand.',
    image: '/assets/products/chat.png',
  },
  {
    id: 'images',
    label: 'IMAGES',
    title: 'Generate, then settle',
    body: 'Describe a scene. You only pay when the image actually generates — wallet-signed, on-chain verified.',
    side: 'Job status streams back live. History lives with your wallet, not a vendor account.',
    image: '/assets/products/images.png',
  },
  {
    id: 'audio',
    label: 'AUDIO',
    title: 'Speech to text',
    body: 'Drop audio, get a transcript. Same wallet flow as chat — micropayments instead of monthly plans.',
    side: 'Built for agents and humans who want usage-priced voice without provisioning keys.',
    image: '/assets/products/audio.png',
  },
  {
    id: 'code',
    label: 'IDE',
    title: 'Algorand TypeScript IDE',
    body: 'Edit, compile, and ship puya-ts. The AI agent is x402-paid so you only fund what you use.',
    side: 'A separate product surface — same wallet, same settlement rail.',
    image: '/assets/products/ide.png',
  },
] as const;

const STEPS = [
  {
    year: '01',
    title: 'Connect wallet',
    body: 'Pera, Defly, Lute, or Kibisis on Algorand. No email signup.',
    visual: 'wallets' as const,
  },
  {
    year: '02',
    title: 'Pick a model',
    body: 'Browse chat, image, and audio models — pricing is clear before you run.',
    visual: 'models' as const,
  },
  {
    year: '03',
    title: 'Pay & run',
    body: 'x402 challenges; you approve; the result lands in your activity.',
    visual: 'usdc' as const,
  },
] as const;

const WALLET_ICONS = [
  { src: '/assets/wallets/pera.png', alt: 'Pera' },
  { src: '/assets/wallets/defly.png', alt: 'Defly' },
  { src: '/assets/wallets/lute.png', alt: 'Lute' },
  { src: '/assets/wallets/kibisis.png', alt: 'Kibisis' },
] as const;

const MODEL_ICONS: { src: string; alt: string; more?: string; }[] = [
  { src: '/assets/providers/openai.png', alt: 'OpenAI' },
  { src: '/assets/providers/claude.png', alt: 'Claude' },
  { src: '/assets/providers/deepseek.png', alt: 'DeepSeek' },
  { src: '/assets/providers/qwen.png', alt: 'Qwen', more: '+20' },
];

function StepVisual({ kind }: { kind: (typeof STEPS)[number]['visual']; }) {
  if (kind === 'wallets') {
    return (
      <div className="step-icons relative z-10 mt-8" aria-label="Supported wallets">
        {WALLET_ICONS.map((w) => (
          <span key={w.alt} className="step-icon" title={w.alt}>
            <img src={w.src} alt={w.alt} width={40} height={40} />
          </span>
        ))}
      </div>
    );
  }
  if (kind === 'models') {
    return (
      <div className="step-icons relative z-10 mt-8" aria-label="Available models">
        {MODEL_ICONS.map((m) => (
          <span key={m.alt} className="step-icon" title={m.alt}>
            <img src={m.src} alt={m.alt} width={40} height={40} />
            {m.more ? <span className="step-icon-more">{m.more}</span> : null}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="step-icons relative z-10 mt-8" aria-label="Pay with USDC">
      <span className="step-icon step-icon-usdc" title="USDC">
        <img src="/assets/usdc.png" alt="USDC" width={48} height={48} />
      </span>
    </div>
  );
}

const FOOTER_COLS = [
  {
    title: 'PRODUCT',
    links: [
      { label: 'App', hrefKey: 'app' as const },
      { label: 'IDE', hrefKey: 'code' as const },
      { label: 'MCP Agents', hrefKey: 'agents' as const },
      { label: 'API Reference', hrefKey: 'api' as const },
      { label: 'Guided demo', hrefKey: 'try' as const },
    ],
  },
  {
    title: 'PROTOCOL',
    links: [
      { label: 'x402 (App)', hrefKey: 'x402app' as const },
      { label: 'x402 (IDE)', hrefKey: 'x402code' as const },
      { label: 'Algorand', href: 'https://algorand.co' },
      { label: 'USDC', href: 'https://www.circle.com/usdc' },
    ],
  },
] as const;

function resolveFooterHref(
  link: { href?: string; hrefKey?: string; },
  appOrigin: string,
  codeOrigin: string,
) {
  if (link.href) return link.href;
  switch (link.hrefKey) {
    case 'app':
      return appOrigin;
    case 'code':
      return codeOrigin;
    case 'agents':
      return `${appOrigin}/agents`;
    case 'api':
      return `${appOrigin}/api-reference`;
    case 'try':
      return `${appOrigin}/try`;
    case 'x402app':
      return `${appOrigin}/.well-known/x402.json`;
    case 'x402code':
      return `${codeOrigin}/.well-known/x402.json`;
    default:
      return appOrigin;
  }
}

function setRevealLines(el: HTMLElement | null, p: number) {
  if (!el) return;
  const lines = el.querySelectorAll<HTMLElement>('.reveal-line');
  if (!lines.length) {
    el.style.setProperty('--reveal', `${Math.round(p * 1000) / 10}%`);
    return;
  }
  const n = lines.length;
  lines.forEach((line, i) => {
    // Fill one line at a time (slight overlap so it feels continuous)
    const start = i / n;
    const end = (i + 0.92) / n;
    const local = Math.min(1, Math.max(0, (p - start) / Math.max(end - start, 0.001)));
    line.style.setProperty('--reveal', `${Math.round(local * 1000) / 10}%`);
  });
}

export function LandingPage({
  appOrigin,
  codeOrigin,
}: {
  appOrigin: string;
  codeOrigin: string;
  siteOrigin: string;
}) {
  const [activeProduct, setActiveProduct] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [cardBackId, setCardBackId] = useState<CardBackId>('standards');
  const [stepProgress, setStepProgress] = useState(0);
  const [productProgress, setProductProgress] = useState(0);

  const pageRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const cardMoverRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<PayCardHandle>(null);
  const lenisRef = useRef<{ scrollTo: (target: number, opts?: object) => void; } | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const heroSlotRef = useRef<HTMLDivElement>(null);
  const standardsRef = useRef<HTMLElement>(null);
  const standardsSlotRef = useRef<HTMLDivElement>(null);
  const visionRef = useRef<HTMLElement>(null);
  const visionTextRef = useRef<HTMLHeadingElement>(null);
  const stepsRef = useRef<HTMLElement>(null);
  const aboutRef = useRef<HTMLElement>(null);
  const aboutTextRef = useRef<HTMLHeadingElement>(null);
  const productsRef = useRef<HTMLElement>(null);
  const settlementRef = useRef<HTMLElement>(null);
  const historyRef = useRef<HTMLElement>(null);
  const historyTextRef = useRef<HTMLHeadingElement>(null);
  const cardBackIdRef = useRef<CardBackId>('standards');

  const setBack = useCallback((id: CardBackId) => {
    if (cardBackIdRef.current === id) return;
    cardBackIdRef.current = id;
    setCardBackId(id);
  }, []);

  const scrollToTop = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { duration: 1.2, immediate: false });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  useClientGsap(
    pageRef,
    (gsap, ScrollTrigger) => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const lenisBag: { destroy?: () => void; } = {};
      if (!reduced) {
        void import('lenis').then(({ default: Lenis }) => {
          const lenis = new Lenis({
            duration: 1.15,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: 0.9,
            touchMultiplier: 1.1,
          });
          lenis.on('scroll', ScrollTrigger.update);
          const tick = (time: number) => {
            lenis.raf(time * 1000);
          };
          gsap.ticker.add(tick);
          gsap.ticker.lagSmoothing(0);
          document.documentElement.classList.add('lenis');
          lenisRef.current = lenis;
          lenisBag.destroy = () => {
            gsap.ticker.remove(tick);
            lenis.destroy();
            lenisRef.current = null;
            document.documentElement.classList.remove('lenis');
          };
        });
      }

      const reveals = gsap.utils.toArray<HTMLElement>('.hero-reveal');
      gsap.set(reveals, { clearProps: 'all' });
      if (!reduced) {
        gsap.fromTo(
          reveals,
          { y: 24, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.85,
            stagger: 0.09,
            ease: 'power3.out',
            delay: 0.05,
            clearProps: 'transform',
          },
        );
      }

      const header = headerRef.current;
      if (header) {
        ScrollTrigger.create({
          start: 24,
          onUpdate: (self) => {
            header.classList.toggle('is-island', self.scroll() > 24);
          },
        });
        header.classList.toggle('is-island', window.scrollY > 24);
      }

      // Progress through a tall sticky section (no pin overlays).
      const finishBy = (p: number, at = 0.88) => Math.min(1, Math.max(0, p / at));

      const scrubSection = (
        section: HTMLElement | null,
        onProgress: (p: number) => void,
        opts?: { onEnter?: () => void; onLeave?: () => void; },
      ) => {
        if (!section) return;
        if (reduced) {
          onProgress(1);
          return;
        }
        ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.7,
          invalidateOnRefresh: true,
          onEnter: opts?.onEnter,
          onEnterBack: opts?.onEnter,
          onLeave: opts?.onLeave,
          onLeaveBack: opts?.onLeave,
          onUpdate: (self) => onProgress(self.progress),
          onRefresh: (self) => onProgress(self.progress),
        });
      };

      const mover = cardMoverRef.current;
      const heroSlot = heroSlotRef.current;
      const standardsSlot = standardsSlotRef.current;
      const hero = heroRef.current;
      const standards = standardsRef.current;

      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
      // Smoothstep with gentler ease-in/out for travel
      const easeFlight = (t: number) => {
        const c = clamp01(t);
        return c * c * c * (c * (c * 6 - 15) + 10); // smootherstep
      };

      const cardWidth = (largeT: number) => {
        const w0 = Math.min(420, window.innerWidth * 0.86);
        const w1 = Math.min(520, window.innerWidth * 0.9);
        return lerp(w0, w1, largeT);
      };

      const placeCard = (progress: number) => {
        if (!mover || !heroSlot || !standardsSlot) return;

        const a = heroSlot.getBoundingClientRect();
        const b = standardsSlot.getBoundingClientRect();
        // Slot may be display:none on small screens — skip until layout is ready
        if (a.width < 8 && b.width < 8) return;

        const from = a.width >= 8 ? a : b;
        const to = b.width >= 8 ? b : a;

        // Park on hero: show in-flow card, hide fixed flyer until flight starts
        if (progress <= 0.001) {
          const staticCard = heroSlot.querySelector<HTMLElement>('.pay-card-slot-static');
          if (staticCard) {
            staticCard.style.opacity = '1';
            staticCard.style.visibility = 'visible';
          }
          mover.classList.add('is-hidden');
          gsap.set(mover, {
            left: from.left,
            top: from.top,
            width: cardWidth(0),
            x: 0,
            y: 0,
            opacity: 0,
            force3D: true,
          });
          cardRef.current?.setRotateY(0);
          setBack('standards');
          return;
        }

        const staticCard = heroSlot.querySelector<HTMLElement>('.pay-card-slot-static');
        if (staticCard) {
          staticCard.style.opacity = '0';
          staticCard.style.visibility = 'hidden';
        }

        const t = easeFlight(progress);
        const arc = Math.sin(t * Math.PI) * Math.min(56, window.innerHeight * 0.06);
        const x = lerp(from.left, to.left, t);
        const y = lerp(from.top, to.top, t) - arc;

        const flip = easeFlight(clamp01((t - 0.18) / 0.55));
        const rotateY = lerp(0, 180, flip);
        const largeT = easeFlight(clamp01((t - 0.35) / 0.45));

        mover.classList.remove('is-hidden');
        gsap.set(mover, {
          left: x,
          top: y,
          width: cardWidth(largeT),
          x: 0,
          y: 0,
          opacity: 1,
          visibility: 'visible',
          force3D: true,
        });
        cardRef.current?.setRotateY(rotateY);
        setBack('standards');
      };

      // Place immediately + after layout so hero card shows before any scroll
      placeCard(0);
      requestAnimationFrame(() => {
        placeCard(0);
        ScrollTrigger.refresh();
      });
      window.setTimeout(() => {
        placeCard(0);
        ScrollTrigger.refresh();
      }, 60);

      // Continuous flight: hero → standards, then follow the slot as it scrolls
      if (hero && standards && !reduced) {
        ScrollTrigger.create({
          trigger: hero,
          start: 'top top',
          endTrigger: standards,
          end: 'top top',
          scrub: 1.35,
          invalidateOnRefresh: true,
          onRefresh: (self) => {
            // Only follow flight progress when this trigger owns the scrub range
            if (self.progress <= 0) placeCard(0);
            else placeCard(self.progress);
          },
          onUpdate: (self) => placeCard(self.progress),
        });

        // Stay locked to the standards slot only while that section is active
        ScrollTrigger.create({
          trigger: standards,
          start: 'top top',
          end: 'bottom top',
          scrub: 1.1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (self.isActive) placeCard(1);
          },
          onRefresh: (self) => {
            if (self.isActive) placeCard(1);
          },
          onEnter: () => placeCard(1),
          onEnterBack: () => placeCard(1),
          onLeaveBack: () => placeCard(0),
        });
      } else {
        placeCard(reduced ? 1 : 0);
      }

      // Re-park after all ScrollTriggers register (refresh used to force progress=1)
      placeCard(0);
      window.setTimeout(() => placeCard(0), 120);

      // Text reveals
      const scrubReveal = (
        section: HTMLElement | null,
        text: HTMLHeadingElement | null,
      ) => {
        if (!section || !text) return;
        if (reduced) {
          setRevealLines(text, 1);
          return;
        }
        setRevealLines(text, 0);
        scrubSection(section, (p) => setRevealLines(text, finishBy(p)));
      };

      scrubReveal(visionRef.current, visionTextRef.current);
      scrubReveal(aboutRef.current, aboutTextRef.current);
      scrubReveal(historyRef.current, historyTextRef.current);

      // Steps
      scrubSection(stepsRef.current, (raw) => {
        const p = finishBy(raw);
        setStepProgress(p);
        setActiveStep(
          Math.min(STEPS.length - 1, Math.floor(p * STEPS.length * 0.999)),
        );
      });

      // Products
      scrubSection(productsRef.current, (raw) => {
        const p = finishBy(raw);
        setProductProgress(p);
        setActiveProduct(
          Math.min(PRODUCTS.length - 1, Math.floor(p * PRODUCTS.length * 0.999)),
        );
      });

      // Settlement fade
      const scrubFade = (section: HTMLElement | null) => {
        if (!section) return;
        const targets = section.querySelectorAll<HTMLElement>('.pin-fade');
        const apply = (raw: number) => {
          const t = finishBy(raw);
          targets.forEach((el, i) => {
            const local = Math.min(1, Math.max(0, (t - i * 0.06) / 0.88));
            gsap.set(el, {
              opacity: 0.15 + 0.85 * local,
              y: 28 * (1 - local),
            });
          });
        };
        if (reduced || !targets.length) {
          apply(1);
          return;
        }
        apply(0);
        scrubSection(section, apply);
      };

      scrubFade(settlementRef.current);

      const onResize = () => ScrollTrigger.refresh();
      window.addEventListener('resize', onResize);
      const boot = window.setTimeout(() => ScrollTrigger.refresh(), 100);

      return () => {
        window.removeEventListener('resize', onResize);
        window.clearTimeout(boot);
        lenisBag.destroy?.();
      };
    },
    [setBack],
  );

  const product = PRODUCTS[activeProduct];
  const step = STEPS[activeStep];

  return (
    <div ref={pageRef} className="flex min-h-svh flex-col bg-paper text-ink">
      <header ref={headerRef} className="site-header">
        <div className="site-header-inner">
          <a
            href="/"
            className="inline-flex items-center gap-2.5 no-underline"
            onClick={scrollToTop}
          >
            <span className="size-3 shrink-0 bg-ink" aria-hidden />
            <span className="text-[1.2rem] font-semibold tracking-tight text-ink lowercase">
              micropay
            </span>
          </a>
          <nav className="site-header-nav text-[0.68rem] font-semibold tracking-[0.14em] text-ink/65 uppercase">
            <a href={appOrigin} className="transition-colors hover:text-ink">
              App
            </a>
            <a href={codeOrigin} className="transition-colors hover:text-ink">
              IDE
            </a>
            <a
              href={`${appOrigin}/agents`}
              className="transition-colors hover:text-ink"
            >
              MCP
            </a>
            <a
              href={`${appOrigin}/api-reference`}
              className="transition-colors hover:text-ink"
            >
              API
            </a>
          </nav>
          <div className="site-header-cta">
            <a href={appOrigin} className="btn-neon">
              Open app
            </a>
          </div>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col">
        <div className="pay-card-layer" aria-hidden>
          <div ref={cardMoverRef} className="pay-card-mover is-hidden">
            <PayCard ref={cardRef} backId={cardBackId} interactive />
          </div>
        </div>

        {/* Hero */}
        <section
          ref={heroRef}
          className="v-grid section-vh relative overflow-hidden bg-paper px-5 pt-28 md:px-8"
        >
          <div className="relative z-10 mx-auto grid w-full max-w-[1200px] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col items-start">
              <h1 className="hero-reveal max-w-xl text-[clamp(2.4rem,5.5vw,4.35rem)] leading-[1.05] font-semibold tracking-tight text-ink">
                <span className="block">Pay for the call.</span>
                <span className="mt-1 block text-stone">Not the plan.</span>
                <span className="font-pixel mt-3 block text-[clamp(1.35rem,2.8vw,2rem)] leading-[1.25] text-ink">
                  Wallet-native AI.
                </span>
                <span className="mt-1 block text-[clamp(1.15rem,2.2vw,1.55rem)] font-medium tracking-tight text-muted-foreground">
                  Settled in USDC on Algorand.
                </span>
              </h1>
              <p className="hero-reveal mt-7 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
                Chat, images, audio, and a puya-ts IDE — each run priced once,
                paid once. No seats. No API keys. No monthly lock-in.
              </p>
              <div className="hero-reveal mt-10 flex flex-wrap items-center gap-5">
                <a href={appOrigin} className="btn-neon">
                  Open app
                </a>
                <a href={codeOrigin} className="link-caps text-ink">
                  Open IDE
                </a>
              </div>
              <div className="hero-reveal mt-12 flex items-center gap-3 text-xs text-muted-foreground">
                <img src="/assets/usdc.png" alt="" className="size-5" width={20} height={20} />
                <span>USDC</span>
                <span className="text-ink/20">|</span>
                <img src="/assets/algorand.png" alt="" className="size-5 rounded" width={20} height={20} />
                <span>Algorand · x402</span>
              </div>
            </div>
            <div className="relative mx-auto flex w-full max-w-lg justify-center lg:max-w-none lg:justify-self-end lg:justify-end">
              <div ref={heroSlotRef} className="pay-card-slot hidden lg:block">
                <div className="pay-card-slot-static">
                  <PayCard backId="standards" interactive />
                </div>
              </div>
              <div className="w-full lg:hidden">
                <div className="mx-auto w-full max-w-[420px]">
                  <PayCard backId="standards" interactive={false} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Challenging standards — natural scroll, no runway pause */}
        <section
          ref={standardsRef}
          className="v-grid section-vh relative overflow-hidden bg-snow px-5 md:px-8"
        >
          <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-col items-center text-center">
            <div className="mb-8 hidden lg:flex lg:justify-center md:mb-10">
              <div ref={standardsSlotRef} className="pay-card-slot pay-card-slot-lg" />
            </div>
            <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-ink/50 uppercase">
              Challenging standards
            </p>
            <h2 className="mt-5 max-w-3xl text-[clamp(1.75rem,4.5vw,3.5rem)] leading-[1.1] font-semibold tracking-tight text-ink">
              It&apos;s time for wallet-native AI
            </h2>
            <div className="mt-6 flex justify-center">
              <PixelAccent variant="cool" />
            </div>
            <p className="mx-auto mt-6 max-w-xl text-[0.95rem] leading-relaxed text-muted-foreground">
              What if using AI didn&apos;t mean provisioning API keys or locking
              into a plan? Micropayments remove account friction — you pay for
              the call, then you&apos;re done.
            </p>
          </div>
        </section>

        {/* Vision */}
        <section ref={visionRef} className="section-story section-story--reveal">
          <div className="section-sticky v-grid-dark bg-void px-5 md:px-8">
            <div
              className="fade-bg fade-bg-dark"
              style={{ backgroundImage: "url('/assets/illustrations/vision-city.png')" }}
              aria-hidden
            />
            <div className="section-pin-inner relative z-10 mx-auto flex w-full max-w-[1200px] flex-col justify-center">
              <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-snow/50 uppercase">
                Our future vision
              </p>
              <h2
                ref={visionTextRef}
                className="reveal-lines mt-8 max-w-4xl text-[clamp(1.85rem,4.2vw,3.4rem)] leading-[1.15] font-semibold tracking-tight"
              >
                <span className="reveal-line">We&apos;re making pay-per-use</span>
                <span className="reveal-line">the default for AI</span>
                <span className="reveal-line">infrastructure.</span>
              </h2>
              <div className="mt-12">
                <PixelAccent variant="warm" />
              </div>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section ref={stepsRef} className="section-story section-story--steps">
          <div className="section-sticky v-grid-dark bg-carbon px-5 md:px-8">
            <div className="section-pin-inner relative z-10 mx-auto w-full max-w-[1200px]">
              <div className="mb-8 flex items-center justify-between gap-6">
                <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-snow/45 uppercase">
                  How it works
                </p>
                <div className="progress-track progress-track-dark max-w-xs flex-1">
                  <div
                    className="progress-fill"
                    style={{ ['--p' as string]: `${stepProgress * 100}%` }}
                  />
                </div>
              </div>
              <div className="grid gap-10 lg:grid-cols-[160px_1fr]">
                <ol className="flex gap-5 lg:flex-col lg:gap-4">
                  {STEPS.map((s, i) => (
                    <li key={s.year}>
                      <button
                        type="button"
                        onClick={() => setActiveStep(i)}
                        className={`font-pixel text-sm transition-colors ${activeStep === i
                          ? 'text-snow'
                          : 'text-snow/30 hover:text-snow/60'
                          }`}
                      >
                        {s.year}
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="panel-noisy relative min-h-[300px] rounded-[var(--radius-btn)] p-8 md:p-12">
                  <p className="font-pixel relative z-10 text-sm text-ink/70">
                    {step.year}
                  </p>
                  <h3 className="relative z-10 mt-5 text-[clamp(1.6rem,3vw,2.4rem)] leading-snug font-semibold text-ink">
                    {step.title}
                  </h3>
                  <p className="relative z-10 mt-4 max-w-lg text-[0.95rem] leading-relaxed text-ink/65">
                    {step.body}
                  </p>
                  <StepVisual kind={step.visual} />
                  <a
                    href={`${appOrigin}/try`}
                    className="btn-neon relative z-10 mt-10 inline-flex"
                  >
                    Guided demo
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About */}
        <section ref={aboutRef} className="section-story section-story--reveal">
          <div className="section-sticky v-grid bg-snow px-5 md:px-8">
            <div className="section-pin-inner relative z-10 mx-auto grid w-full max-w-[1200px] items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
              <div>
                <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-ink/50 uppercase">
                  Owned by the community
                </p>
                <h2
                  ref={aboutTextRef}
                  className="reveal-lines reveal-text-ink mt-6 max-w-3xl text-[clamp(2rem,4.2vw,3.4rem)] leading-[1.12] font-semibold tracking-tight"
                >
                  <span className="reveal-line">We build the rails for</span>
                  <span className="reveal-line">agents and humans to</span>
                  <span className="reveal-line">pay as they go.</span>
                </h2>
                <div className="mt-10">
                  <PixelAccent variant="warm" />
                </div>
              </div>
              <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
                <img
                  src="/assets/illustrations/about-hands.png"
                  alt=""
                  className="h-auto w-full scale-105 object-contain lg:scale-110"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Products */}
        <section ref={productsRef} className="section-story section-story--products">
          <div className="section-sticky v-grid bg-paper px-5 md:px-8">
            <div className="section-pin-inner relative z-10 mx-auto w-full max-w-[1200px]">
              <div className="mb-6 flex items-center justify-between gap-6 md:mb-8">
                <div>
                  <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-ink/50 uppercase">
                    Products
                  </p>
                  <p className="mt-2 text-[0.72rem] font-semibold tracking-[0.14em] text-ink/35 uppercase">
                    {product.label}
                  </p>
                </div>
                <div className="progress-track max-w-xs flex-1">
                  <div
                    className="progress-fill"
                    style={{ ['--p' as string]: `${productProgress * 100}%` }}
                  />
                </div>
              </div>
              <div className="product-panel relative overflow-hidden rounded-[var(--radius-btn)] p-7 md:p-10 lg:p-12">
                <div
                  className="product-panel-bg"
                  style={{ backgroundImage: `url('${product.image}')` }}
                  aria-hidden
                />
                <div className="product-panel-scrim" aria-hidden />
                <div className="relative z-10 flex min-h-[inherit] flex-col justify-between gap-8 md:flex-row md:items-start">
                  <div className="max-w-xl">
                    <h3 className="text-[clamp(1.6rem,3.2vw,2.5rem)] font-semibold tracking-tight text-ink">
                      {product.title}
                    </h3>
                    <div className="mt-6 grid gap-5 sm:mt-8 sm:grid-cols-2 sm:gap-6">
                      <p className="text-sm leading-relaxed text-ink/80">
                        {product.body}
                      </p>
                      <p className="text-sm leading-relaxed text-ink/65">
                        {product.side}
                      </p>
                    </div>
                  </div>
                  <a
                    href={product.id === 'code' ? codeOrigin : appOrigin}
                    className="btn-neon shrink-0 self-start md:self-end"
                  >
                    Learn more
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Settlement */}
        <section ref={settlementRef} className="section-story section-story--fade">
          <div className="section-sticky v-grid bg-snow px-5 md:px-8">
            <div className="relative z-10 mx-auto grid w-full max-w-[1200px] items-center gap-14 lg:grid-cols-2">
              <div className="pin-fade relative mx-auto w-full max-w-lg">
                <img
                  src="/assets/illustrations/settlement.png"
                  alt=""
                  className="h-auto w-full object-contain"
                />
              </div>
              <div className="pin-fade">
                <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-ink/50 uppercase">
                  Settlement stack
                </p>
                <h2 className="mt-5 text-[clamp(1.85rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight text-ink">
                  Built on open rails
                </h2>
                <div className="mt-6">
                  <PixelAccent variant="cool" />
                </div>
                <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Algorand for settlement speed, USDC for stable pricing, x402 for
                  HTTP-native payments, MCP for agent discovery.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* History */}
        <section ref={historyRef} className="section-story section-story--reveal">
          <div className="section-sticky v-grid-dark bg-void px-5 md:px-8">
            <div className="section-pin-inner relative z-10 mx-auto grid w-full max-w-[1200px] items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="relative mx-auto w-full max-w-sm">
                <img
                  src="/assets/illustrations/history-pizza.png"
                  alt=""
                  className="h-auto w-full object-contain"
                />
              </div>
              <div>
                <p className="text-[0.7rem] font-semibold tracking-[0.2em] text-snow/45 uppercase">
                  In our history
                </p>
                <h2
                  ref={historyTextRef}
                  className="reveal-lines mt-8 max-w-3xl text-[clamp(1.7rem,3.8vw,3rem)] leading-[1.2] font-semibold tracking-tight"
                >
                  <span className="reveal-line">As builders of wallet-paid AI,</span>
                  <span className="reveal-line">the future of inference is</span>
                  <span className="reveal-line">usage — not seats.</span>
                </h2>
                <div className="mt-12">
                  <PixelAccent />
                </div>
              </div>
            </div>
          </div>
        </section>

        <FaqSection />
      </main>

      <footer className="v-grid-dark relative overflow-hidden bg-carbon text-snow">
        <div className="relative z-10 mx-auto grid w-full max-w-[1200px] gap-14 px-5 py-24 md:grid-cols-[1.1fr_1fr_1fr] md:px-8 md:py-32">
          <div>
            <a href="/" className="inline-flex items-center gap-2.5 no-underline">
              <span className="size-3 shrink-0 bg-snow" aria-hidden />
              <span className="text-lg font-semibold tracking-tight text-snow lowercase">
                micropay
              </span>
            </a>
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-snow/45">
              Pay-per-use AI gateway on Algorand. Chat, images, audio, and an IDE
              — settled in USDC via x402.
            </p>
            <div className="mt-12 hidden md:block" aria-hidden>
              <PixelAccent />
            </div>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.title} className="">
              <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-snow/55 uppercase">
                {col.title}
              </p>
              <ul className="mt-6 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={resolveFooterHref(link, appOrigin, codeOrigin)}
                      className="text-sm text-snow/75 no-underline transition-colors hover:text-snow"
                      {...('href' in link && link.href?.startsWith('http')
                        ? { target: '_blank', rel: 'noreferrer' }
                        : {})}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
