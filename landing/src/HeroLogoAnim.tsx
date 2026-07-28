import { useId, useRef } from 'react'

import { useClientGsap } from './use-client-gsap'

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ')
}

const BOUNCE_TARGETS = [
  { x: 0, y: 0, letterIndex: -1 },
  { x: 196, y: -135, letterIndex: 0 },
  { x: 315, y: -135, letterIndex: 1 },
  { x: 415, y: -98, letterIndex: 2 },
  { x: 552, y: -98, letterIndex: 3 },
  { x: 686, y: -98, letterIndex: 4 },
  { x: 835, y: -98, letterIndex: 5 },
  { x: 978, y: -98, letterIndex: 6 },
  { x: 1118, y: -98, letterIndex: 7 },
] as const;

type BounceTarget = (typeof BOUNCE_TARGETS)[number];

/**
 * Hero brand: pixel MicroPay wordmark with the green mark hopping letter-to-letter.
 */
export function HeroLogoAnim({ className }: { className?: string; }) {
  const root = useRef<HTMLDivElement>(null);
  const reactId = useId().replace(/:/g, '');
  const ids = {
    greenGlow: `hl-green-glow-${reactId}`,
    softShadow: `hl-soft-shadow-${reactId}`,
    coneGlow: `hl-cone-glow-${reactId}`,
    letterGrad: `hl-letter-grad-${reactId}`,
    characterGrad: `hl-character-grad-${reactId}`,
  };

  useClientGsap(root, (gsap) => {
    const scope = root.current;
    if (!scope) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const bouncerGroup = scope.querySelector<SVGGElement>('[data-bouncer]');
    const ripplesLayer = scope.querySelector<SVGGElement>('[data-ripples]');
    const ambientGlow = scope.querySelector<HTMLElement>('[data-ambient]');
    const blockShadow = scope.querySelector<SVGEllipseElement>('[data-block-shadow]');
    const floorGlow = scope.querySelector<SVGEllipseElement>('[data-floor-glow]');
    const pupils = scope.querySelectorAll<SVGCircleElement>('[data-pupil]');
    const eyeLeft = scope.querySelector<SVGEllipseElement>('[data-eye-left]');
    const eyeRight = scope.querySelector<SVGEllipseElement>('[data-eye-right]');

    if (
      !bouncerGroup ||
      !ripplesLayer ||
      !ambientGlow ||
      !blockShadow ||
      !floorGlow ||
      !eyeLeft ||
      !eyeRight
    ) {
      return;
    }

    const createImpactRipple = (cx: number, cy: number) => {
      const circle = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle',
      );
      circle.setAttribute('cx', String(cx));
      circle.setAttribute('cy', String(cy));
      circle.setAttribute('r', '8');
      circle.setAttribute('class', 'hero-logo-ripple');
      ripplesLayer.appendChild(circle);

      gsap.to(circle, {
        attr: { r: 65 },
        opacity: 0,
        strokeWidth: 0.2,
        duration: 0.55,
        ease: 'power2.out',
        onComplete: () => circle.remove(),
      });
    };

    const handleImpact = (target: BounceTarget) => {
      const absoluteX = target.x + 43.5;
      const absoluteY = target.y + 226;

      createImpactRipple(absoluteX, absoluteY);

      gsap
        .timeline()
        .to(bouncerGroup, {
          scaleY: 0.58,
          scaleX: 1.38,
          duration: 0.08,
          ease: 'power2.in',
        })
        .to(bouncerGroup, {
          scaleY: 1.12,
          scaleX: 0.9,
          duration: 0.16,
          ease: 'back.out(1.6)',
        })
        .to(bouncerGroup, {
          scaleY: 0.96,
          scaleX: 1.04,
          duration: 0.1,
          ease: 'sine.inOut',
        })
        .to(bouncerGroup, {
          scaleY: 1,
          scaleX: 1,
          duration: 0.12,
          ease: 'power2.out',
        });

      gsap
        .timeline()
        .to([eyeLeft, eyeRight], {
          scaleY: 0.12,
          duration: 0.05,
          transformOrigin: 'center center',
        })
        .to([eyeLeft, eyeRight], {
          scaleY: 1,
          duration: 0.12,
          transformOrigin: 'center center',
          ease: 'back.out(1.4)',
        });

      if (target.letterIndex >= 0) {
        const letterElem = scope.querySelector(
          `[data-letter="${target.letterIndex}"]`,
        );
        if (letterElem) {
          gsap
            .timeline()
            .to(letterElem, {
              scaleY: 0.62,
              scaleX: 1,
              duration: 0.09,
              ease: 'power2.out',
            })
            .to(letterElem, {
              scaleY: 1.06,
              scaleX: 1,
              duration: 0.18,
              ease: 'back.out(1.8)',
            })
            .to(letterElem, {
              scaleY: 1,
              scaleX: 1,
              duration: 0.28,
              ease: 'power2.out',
            });
        }
      }

      gsap.to(ambientGlow, {
        x: (target.x - 500) * 0.38,
        y: target.y * 0.18,
        duration: 0.45,
        ease: 'power2.out',
      });
    };

    const lookTowards = (xDir: number, yDir: number) => {
      gsap.to(pupils, {
        x: xDir,
        y: yDir,
        duration: 0.14,
        ease: 'power2.out',
      });
    };

    const mainTL = gsap.timeline({ repeat: -1, repeatDelay: 0.2 });

    mainTL.to(bouncerGroup, {
      scaleY: 0.68,
      scaleX: 1.28,
      duration: 0.28,
      ease: 'power2.inOut',
      onStart: () => lookTowards(7, -3),
    });

    const fullPath: Array<{
      current: BounceTarget;
      next: BounceTarget;
      direction: number;
    }> = [];
    for (let i = 0; i < BOUNCE_TARGETS.length - 1; i++) {
      fullPath.push({
        current: BOUNCE_TARGETS[i],
        next: BOUNCE_TARGETS[i + 1],
        direction: 1,
      });
    }
    for (let i = BOUNCE_TARGETS.length - 1; i > 0; i--) {
      fullPath.push({
        current: BOUNCE_TARGETS[i],
        next: BOUNCE_TARGETS[i - 1],
        direction: -1,
      });
    }

    fullPath.forEach((hop, idx) => {
      const { current, next, direction: dir } = hop;
      const hopDuration = 0.44;
      const apexY = Math.min(current.y, next.y) - 78;
      const label = `hop_${idx}`;

      mainTL.to(
        bouncerGroup,
        {
          x: next.x,
          duration: hopDuration,
          ease: 'none',
        },
        label,
      );

      mainTL.to(
        bouncerGroup,
        {
          y: apexY,
          duration: hopDuration * 0.46,
          ease: 'power2.out',
          onStart: () => {
            lookTowards(5 * dir, -8);
            gsap.to(bouncerGroup, {
              scaleY: 1.26,
              scaleX: 0.82,
              rotation: 4 * dir,
              duration: 0.18,
              ease: 'power2.out',
            });
          },
        },
        label,
      );

      mainTL.to(
        bouncerGroup,
        {
          y: next.y,
          duration: hopDuration * 0.54,
          ease: 'power1.in',
          onStart: () => {
            lookTowards(3 * dir, 6);
            gsap.to(bouncerGroup, {
              rotation: 0,
              duration: hopDuration * 0.54,
              ease: 'sine.in',
            });
          },
          onComplete: () => handleImpact(next),
        },
        `${label}+=${hopDuration * 0.46}`,
      );

      mainTL.to(
        [blockShadow, floorGlow],
        {
          x: next.x,
          scaleX: 0.75,
          opacity: 0.2,
          duration: hopDuration * 0.46,
          ease: 'sine.out',
        },
        label,
      );

      mainTL.to(
        [blockShadow, floorGlow],
        {
          scaleX: 1,
          opacity: 0.4,
          duration: hopDuration * 0.54,
          ease: 'sine.in',
        },
        `${label}+=${hopDuration * 0.46}`,
      );
    });

    mainTL.to(bouncerGroup, {
      duration: 0.15,
      onStart: () => lookTowards(0, 0),
    });
  }, []);

  return (
    <div
      ref={root}
      className={cn(
        'hero-logo-anim relative mx-auto flex w-[min(92vw,311px)] flex-col items-center',
        className,
      )}
      aria-label="MicroPay"
      role="img"
    >
      <div
        data-ambient
        className="pointer-events-none absolute left-1/2 top-1/2 size-[min(22vw,180px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(9,199,43,0.14)_0%,rgba(9,199,43,0)_70%)] blur-2xl"
        aria-hidden
      />
      <div className="relative z-2 w-full aspect-1243/464">
        <svg
          className="h-full w-full overflow-visible"
          viewBox="0 -80 1243 444"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <filter
              id={ids.greenGlow}
              x="-80%"
              y="-80%"
              width="260%"
              height="260%"
            >
              <feGaussianBlur stdDeviation="10" result="blur1" />
              <feGaussianBlur stdDeviation="4" result="blur2" />
              <feMerge>
                <feMergeNode in="blur1" />
                <feMergeNode in="blur2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter
              id={ids.softShadow}
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feDropShadow
                dx="0"
                dy="12"
                stdDeviation="8"
                floodColor="#000000"
                floodOpacity="0.6"
              />
            </filter>
            <linearGradient
              id={ids.coneGlow}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#10e06e" stopOpacity="0.75" />
              <stop offset="60%" stopColor="#09c72b" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#09c72b" stopOpacity="0" />
            </linearGradient>
            <linearGradient
              id={ids.letterGrad}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#D8E2EC" />
            </linearGradient>
            <linearGradient
              id={ids.characterGrad}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#16f37a" />
              <stop offset="100%" stopColor="#089b3f" />
            </linearGradient>
          </defs>

          <g data-ripples />

          <g>
            <ellipse
              data-block-shadow
              cx="43.5"
              cy="230"
              rx="42"
              ry="7"
              fill="#000000"
              className="hero-logo-letter-shadow"
            />
            <ellipse
              data-floor-glow
              cx="43.5"
              cy="230"
              rx="55"
              ry="12"
              fill="#10e06e"
              className="hero-logo-floor-light"
            />
          </g>

          <g>
            <g
              data-letter="0"
              className="hero-logo-letter"
              style={{ filter: `url(#${ids.softShadow})` }}
            >
              <path
                fill={`url(#${ids.letterGrad})`}
                d="M230.857 181.929H212.643V163.714H194.429V273H158V90.8571H194.429V109.071H212.643V127.286H230.857V145.5H249.071V127.286H267.286V109.071H285.5V90.8571H321.929V273H285.5V163.714H267.286V181.929H249.071V200.143H230.857V181.929Z"
              />
            </g>
            <g
              data-letter="1"
              className="hero-logo-letter"
              style={{ filter: `url(#${ids.softShadow})` }}
            >
              <path
                fill={`url(#${ids.letterGrad})`}
                d="M340.285 90.8571H376.714V127.286H340.285V90.8571ZM340.285 145.5H376.714V273H340.285V145.5Z"
              />
            </g>
            <g
              data-letter="2"
              className="hero-logo-letter"
              style={{ filter: `url(#${ids.softShadow})` }}
            >
              <path
                fill={`url(#${ids.letterGrad})`}
                d="M486.142 218.357H522.57V254.786H504.356V273H413.285V254.786H395.07V145.5H413.285V127.286H504.356V145.5H522.57V181.929H486.142V163.714H431.499V236.571H486.142V218.357Z"
              />
            </g>
            <g
              data-letter="3"
              className="hero-logo-letter"
              style={{ filter: `url(#${ids.softShadow})` }}
            >
              <path
                fill={`url(#${ids.letterGrad})`}
                d="M613.689 163.714H595.475V181.929H577.261V273H540.832V127.286H577.261V145.5H595.475V127.286H631.903V145.5H650.118V163.714H631.903V181.929H613.689V163.714Z"
              />
            </g>
            <g
              data-letter="4"
              className="hero-logo-letter"
              style={{ filter: `url(#${ids.softShadow})` }}
            >
              <path
                fill={`url(#${ids.letterGrad})`}
                d="M668.332 145.5H686.546V127.286H777.618V145.5H795.832V254.786H777.618V273H686.546V254.786H668.332V145.5ZM759.403 163.714H704.761V236.571H759.403V163.714Z"
              />
            </g>
            <g
              data-letter="5"
              className="hero-logo-letter"
              style={{ filter: `url(#${ids.softShadow})` }}
            >
              <path
                fill={`url(#${ids.letterGrad})`}
                d="M850.522 236.571H905.165V163.714H850.522V236.571ZM850.522 145.5H868.737V127.286H923.379V145.5H941.594V254.786H923.379V273H850.522V309.429H814.094V127.286H850.522V145.5Z"
              />
            </g>
            <g
              data-letter="6"
              className="hero-logo-letter"
              style={{ filter: `url(#${ids.softShadow})` }}
            >
              <path
                fill={`url(#${ids.letterGrad})`}
                d="M978.07 254.786H959.855V200.143H978.07V181.929H1050.93V163.714H959.855V145.5H978.07V127.286H1069.14V145.5H1087.36V273H1050.93V254.786H1032.71V273H978.07V254.786ZM996.284 236.571H1050.93V218.357H996.284V236.571Z"
              />
            </g>
            <g
              data-letter="7"
              className="hero-logo-letter"
              style={{ filter: `url(#${ids.softShadow})` }}
            >
              <path
                fill={`url(#${ids.letterGrad})`}
                d="M1105.62 273H1123.83V254.786H1142.05V236.571H1123.83V218.357H1105.62V127.286H1142.05V200.143H1160.26V218.357H1178.47V127.286H1214.9V236.571H1196.69V254.786H1178.47V273H1160.26V291.214H1142.05V309.429H1105.62V273Z"
              />
            </g>
          </g>

          <g data-bouncer className="hero-logo-bouncer">
            <polygon
              className="hero-logo-light-cone"
              points="43.5,182.5 -40,360 127,360"
              fill={`url(#${ids.coneGlow})`}
            />
            <rect
              x="0"
              y="139"
              width="87"
              height="87"
              rx="22"
              ry="22"
              fill={`url(#${ids.characterGrad})`}
              filter={`url(#${ids.greenGlow})`}
            />
            <g>
              <ellipse
                data-eye-left
                cx="28"
                cy="175"
                rx="11"
                ry="14"
                fill="#FFFFFF"
              />
              <circle data-pupil cx="30" cy="176" r="5.5" fill="#031409" />
              <circle cx="32.5" cy="172.5" r="2.5" fill="#FFFFFF" />
              <ellipse
                data-eye-right
                cx="59"
                cy="175"
                rx="11"
                ry="14"
                fill="#FFFFFF"
              />
              <circle data-pupil cx="61" cy="176" r="5.5" fill="#031409" />
              <circle cx="63.5" cy="172.5" r="2.5" fill="#FFFFFF" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
