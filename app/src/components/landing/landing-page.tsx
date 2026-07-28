import { Link } from '@tanstack/react-router';
import { ArrowRight, Code, ImageIcon, MessageSquare, Mic } from 'lucide-react';
import { useRef, useState } from 'react';

import { BrandMark } from '#/components/brand';
import { HeroLogoAnim } from '#/components/landing/hero-logo-anim';
import { Button } from '#/components/ui/button';
import { PROVIDER_LOGO } from '#/lib/provider-logos';
import { useClientGsap } from '#/lib/use-client-gsap';
import { cn } from '#/lib/utils';

const MOMENTS = [
  {
    id: 'chat',
    icon: MessageSquare,
    label: 'Chat',
    line: 'Ask anything. Get a clear answer.',
    preview: 'What should I name my product to make it stand out?',
  },
  {
    id: 'image',
    icon: ImageIcon,
    label: 'Images',
    line: 'Describe a scene. See it appear.',
    preview: 'Soft dawn light over a quiet harbor in the morning.',
  },
  {
    id: 'audio',
    icon: Mic,
    label: 'Audio',
    line: 'Speak freely. Read it back as text.',
    preview: 'Meeting notes, ready in seconds with detailed transcription.',
  },
  {
    id: 'code',
    icon: Code,
    label: 'Code',
    line: 'Write code. Get it running.',
    preview: 'Write an Algorand smart contract in TypeScript.',
  },
] as const;

/** Quiet brand marks for the product moment â€” keep the set small. */
const MOMENT_LOGOS = [
  { src: PROVIDER_LOGO.openai, alt: 'OpenAI' },
  { src: PROVIDER_LOGO.claude, alt: 'Claude' },
  { src: PROVIDER_LOGO.deepseek, alt: 'DeepSeek' },
  { src: PROVIDER_LOGO.glm, alt: 'GLM' },
  { src: PROVIDER_LOGO.minimax, alt: 'MiniMax' },
] as const;

const PAY_STEPS = [
  'Open the app and ask.',
  'Approve the USDC amount.',
  'Get the result — nothing else owed.',
] as const;

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const [activeMoment, setActiveMoment] = useState<(typeof MOMENTS)[number]['id']>('chat');
  const moment = MOMENTS.find((m) => m.id === activeMoment) ?? MOMENTS[0];
  const MomentIcon = moment.icon;

  useClientGsap(
    root,
    (gsap) => {
      gsap.from('.hero-brand', {
        y: 28,
        opacity: 0,
        duration: 1.05,
        ease: 'power3.out',
      });
      gsap.from('.hero-copy > *:not(.hero-brand)', {
        y: 18,
        opacity: 0,
        duration: 0.7,
        stagger: 0.11,
        delay: 0.22,
        ease: 'power2.out',
      });
      gsap.from('.hero-arc', {
        opacity: 0,
        y: 28,
        duration: 1.35,
        delay: 0.2,
        ease: 'power2.out',
      });
      gsap.to('.hero-arc-glow', {
        opacity: 0.55,
        duration: 2.8,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });

      gsap.from('.moment-orbit', {
        opacity: 0,
        scale: 0.94,
        duration: 1.1,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.section-moments',
          start: 'top 70%',
          once: true,
        },
      });

      gsap.to('.moment-orbit-ring', {
        rotate: 360,
        duration: 48,
        repeat: -1,
        ease: 'none',
        transformOrigin: '50% 50%',
      });

      gsap.utils.toArray<HTMLElement>('.section-reveal').forEach((section) => {
        gsap.from(section.querySelectorAll('.reveal-item'), {
          y: 28,
          opacity: 0,
          duration: 0.75,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 72%',
            once: true,
          },
        });
      });

      gsap.from('.pay-rail', {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 0.9,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.section-pay',
          start: 'top 68%',
          once: true,
        },
      });
    },
    [],
    { scrollTrigger: true },
  );

  return (
    <div ref={root} className="landing-atmosphere min-h-screen">
      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 md:px-8">
        <BrandMark size="sm" />
        <Button size="sm" asChild>
          <Link to="/models">Open app</Link>
        </Button>
      </header>

      {/* Hero — animated MicroPay brand; nested glow arcs on bottom edge */}
      <section className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-5 pb-28 pt-24 md:px-8 md:pb-36">
        <div
          className="hero-arc pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center"
          aria-hidden
        >
          {/* Primary full-width upward glow arc — sits on hero bottom */}
          <svg
            className="hero-arc-svg h-[clamp(160px,24vw,300px)] w-full translate-y-[18%]"
            viewBox="0 0 1440 280"
            preserveAspectRatio="none"
            fill="none"
          >
            <defs>
              <linearGradient
                id="arcStroke"
                x1="0"
                y1="180"
                x2="1440"
                y2="180"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="rgba(208,214,224,0)" />
                <stop offset="18%" stopColor="rgba(229,229,230,0.28)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.72)" />
                <stop offset="82%" stopColor="rgba(229,229,230,0.28)" />
                <stop offset="100%" stopColor="rgba(208,214,224,0)" />
              </linearGradient>
              <filter
                id="arcSoftGlow"
                x="-8%"
                y="-80%"
                width="116%"
                height="260%"
              >
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path
              className="hero-arc-glow"
              d="M 0 210 C 360 48, 1080 48, 1440 210"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="12"
              strokeLinecap="round"
              filter="url(#arcSoftGlow)"
              opacity="0.32"
            />
            <path
              d="M 0 210 C 360 48, 1080 48, 1440 210"
              stroke="url(#arcStroke)"
              strokeWidth="1.15"
              strokeLinecap="round"
            />
          </svg>

          {/* Smaller nested copies stacked below the primary arc */}
          <svg
            className="-mt-[clamp(64px,10vw,120px)] h-[clamp(100px,16vw,200px)] w-[92%] translate-y-[12%] opacity-55"
            viewBox="0 0 1440 280"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              className="hero-arc-glow"
              d="M 0 210 C 360 48, 1080 48, 1440 210"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="9"
              strokeLinecap="round"
              filter="url(#arcSoftGlow)"
              opacity="0.24"
            />
            <path
              d="M 0 210 C 360 48, 1080 48, 1440 210"
              stroke="url(#arcStroke)"
              strokeWidth="0.95"
              strokeLinecap="round"
              opacity="0.7"
            />
          </svg>
          <svg
            className="-mt-[clamp(40px,7vw,84px)] h-[clamp(64px,11vw,140px)] w-[84%] translate-y-[8%] opacity-35"
            viewBox="0 0 1440 280"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              className="hero-arc-glow"
              d="M 0 210 C 360 48, 1080 48, 1440 210"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="7"
              strokeLinecap="round"
              filter="url(#arcSoftGlow)"
              opacity="0.18"
            />
            <path
              d="M 0 210 C 360 48, 1080 48, 1440 210"
              stroke="url(#arcStroke)"
              strokeWidth="0.8"
              strokeLinecap="round"
              opacity="0.55"
            />
          </svg>
        </div>

        <div className="hero-copy relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
          <HeroLogoAnim className="hero-brand" />
          <h1 className="mt-4 text-xl font-medium tracking-tight text-paper md:mt-5 md:text-2xl">
            AI that bills by the message.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            Chat, create images, and transcribe audio. Pay with your wallet —
            only for what you use.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild className="landing-cta">
              <Link to="/models">
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="landing-cta">
              <Link to="/api-reference">For developers</Link>
            </Button>
          </div>
          <div className="mt-9 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <img
              src="/assets/usdc.png"
              alt="USDC"
              className="size-5"
              width={20}
              height={20}
            />
            <span>USDC</span>
            <span className="text-border">|</span>
            <img
              src="/assets/algorand.png"
              alt="Algorand"
              className="size-5 rounded"
              width={20}
              height={20}
            />
            <span>Algorand</span>
          </div>
        </div>
      </section>

      {/* Product moment */}
      <section className="section-reveal section-moments relative flex min-h-svh items-center overflow-hidden border-t border-border/60 px-5 py-24 md:px-8">
        <div className="section-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="moment-orbit pointer-events-none absolute left-1/2 top-1/2 z-0 size-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2" aria-hidden>
          <div className="moment-orbit-ring absolute inset-0 rounded-full border border-mist/6" />
          <div className="absolute inset-[12%] rounded-full border border-dashed border-mist/5" />
          <div className="absolute inset-[28%] rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_68%)]" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
          <p className="reveal-item text-xs uppercase tracking-[0.2em] text-fog">
            One place
          </p>
          <h2 className="reveal-item mt-4 text-2xl font-medium tracking-tight text-paper md:text-3xl">
            Chat. Images. Audio. Code.
          </h2>
          <p className="reveal-item mx-auto mt-3 max-w-md text-muted-foreground">
            Pick a moment. Stay in flow. No dashboards in the way.
          </p>

          <div
            className="reveal-item mt-12 flex flex-wrap items-center justify-center gap-2"
            role="tablist"
            aria-label="What you can do"
          >
            {MOMENTS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeMoment === id}
                onClick={() => setActiveMoment(id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm transition-colors duration-200',
                  activeMoment === id
                    ? 'border-mist/30 bg-obsidian text-paper'
                    : 'border-transparent text-fog hover:border-border hover:bg-carbon hover:text-mist',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="reveal-item moment-panel relative mx-auto mt-10 max-w-lg overflow-hidden">
            <div className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-mist/3 blur-2xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-12 -left-6 size-28 rounded-full bg-mist/[0.025] blur-2xl" aria-hidden />

            <div
              key={moment.id}
              className="relative animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
              role="tabpanel"
            >
              <div className="mx-auto mb-5 flex size-10 items-center justify-center rounded-md border border-border/80 bg-void/80">
                <MomentIcon className="size-4 text-mist/80" />
              </div>
              <p className="text-lg font-medium tracking-tight text-paper">
                {moment.line}
              </p>
              <p className="mt-6 border-l border-mist/25 py-1 pl-4 text-left text-sm italic text-fog">
                “{moment.preview}”
              </p>
            </div>

            <ul
              className="moment-brands relative mt-10 flex flex-wrap items-center justify-center gap-5 border-t border-border/50 pt-8 md:gap-7"
              aria-label="Familiar model families"
            >
              {MOMENT_LOGOS.map(({ src, alt }) => (
                <li key={alt} className="moment-brand-chip">
                  <img
                    src={src}
                    alt={alt}
                    title={alt}
                    className="size-6 object-contain md:size-7"
                    width={28}
                    height={28}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Pay with wallet */}
      <section className="section-reveal section-pay relative flex min-h-svh items-center overflow-hidden border-t border-border/60 px-5 py-24 md:px-8">
        <div className="section-dots pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute right-[-10%] top-1/2 size-[min(70vw,420px)] -translate-y-1/2 rounded-full border border-mist/5"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-[2%] top-1/2 size-[min(48vw,280px)] -translate-y-1/2 rounded-full border border-dashed border-mist/4"
          aria-hidden
        />

        <div className="relative z-10 mx-auto w-full max-w-xl text-center">
          <p className="reveal-item text-xs uppercase tracking-[0.2em] text-fog">
            Pay as you go
          </p>
          <h2 className="reveal-item mt-4 text-2xl font-medium tracking-tight text-paper md:text-3xl">
            Confirm in your wallet. Done.
          </h2>
          <p className="reveal-item mx-auto mt-3 max-w-md text-muted-foreground">
            Each request shows an exact USDC amount. Approve once — then your
            reply, image, or transcript arrives.
          </p>

          <ol className="reveal-item relative mx-auto mt-14 max-w-sm space-y-6 text-left">
            <span
              className="pay-rail absolute top-3 bottom-3 left-[13px] w-px origin-left bg-linear-to-b from-mist/25 via-border to-transparent"
              aria-hidden
            />
            {PAY_STEPS.map((step, i) => (
              <li
                key={step}
                className="group relative flex items-start gap-4 text-sm text-muted-foreground transition-colors duration-200 hover:text-mist"
              >
                <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-carbon text-xs text-paper transition-colors duration-200 group-hover:border-mist/40 group-hover:bg-obsidian">
                  {i + 1}
                </span>
                <span className="pt-1.5">{step}</span>
              </li>
            ))}
          </ol>

          <div className="reveal-item mt-12 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 rounded-md border border-border/70 bg-carbon/60 px-3 py-2">
              <img src="/assets/usdc.png" alt="" className="size-4" width={16} height={16} />
              <span className="text-[11px] text-fog">Exact amount · per request</span>
              <span className="text-border">·</span>
              <img src="/assets/algorand.png" alt="" className="size-4 rounded-sm" width={16} height={16} />
              <span className="text-[11px] text-fog">Wallet confirm</span>
            </div>
            <Button size="lg" asChild className="landing-cta">
              <Link to="/models">
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 px-5 py-10 md:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <BrandMark size="sm" />
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/models" className="transition-colors hover:text-paper">
              App
            </Link>
            <a
              href={
                (typeof import.meta !== 'undefined' &&
                  (import.meta.env?.VITE_PUBLIC_CODE_URL as string | undefined)?.replace(
                    /\/$/,
                    '',
                  )) ||
                '/ide'
              }
              className="hidden transition-colors hover:text-paper lg:inline"
            >
              IDE
            </a>
            <Link
              to="/api-reference"
              className="transition-colors hover:text-paper"
            >
              API
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 Micropay</p>
        </div>
      </footer>
    </div>
  );
}
