/** Isometric geometric cluster — Unifi-inspired hero visual without external 3D assets. */
export function HeroGeometry({ className = '' }: { className?: string }) {
  return (
    <div className={`relative aspect-square w-full max-w-[560px] ${className}`} aria-hidden>
      <svg
        viewBox="0 0 640 640"
        className="h-full w-full anim-float"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hg-iridescent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="35%" stopColor="#a855f7" />
            <stop offset="65%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
          <linearGradient id="hg-water" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>
          <linearGradient id="hg-moss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#166534" />
          </linearGradient>
          <linearGradient id="hg-chrome" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#111" />
            <stop offset="40%" stopColor="#777" />
            <stop offset="70%" stopColor="#111" />
            <stop offset="100%" stopColor="#ddd" />
          </linearGradient>
          <pattern id="hg-noise" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="#cfcfcf" />
            <circle cx="4" cy="8" r="0.8" fill="#999" opacity="0.5" />
            <circle cx="18" cy="22" r="0.6" fill="#888" opacity="0.4" />
            <circle cx="30" cy="12" r="0.7" fill="#aaa" opacity="0.45" />
            <circle cx="12" cy="34" r="0.5" fill="#777" opacity="0.35" />
          </pattern>
          <filter id="hg-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>

        {/* moon */}
        <circle className="anim-drift" cx="168" cy="148" r="28" fill="#d4d4d4" />
        <circle cx="158" cy="140" r="6" fill="#bdbdbd" opacity="0.7" />
        <circle cx="178" cy="156" r="4" fill="#b0b0b0" opacity="0.6" />

        {/* black sphere */}
        <circle cx="390" cy="150" r="72" fill="#0a0a0a" />
        <ellipse cx="370" cy="130" rx="22" ry="12" fill="#222" opacity="0.8" />

        {/* isometric cube helper paths */}
        {/* back concrete cube */}
        <g transform="translate(250 210)">
          <path d="M0 40 L70 0 L140 40 L70 80 Z" fill="url(#hg-noise)" />
          <path d="M0 40 L0 120 L70 160 L70 80 Z" fill="#9a9a9a" />
          <path d="M70 80 L70 160 L140 120 L140 40 Z" fill="#7a7a7a" />
        </g>

        {/* moss cube */}
        <g transform="translate(180 280)">
          <path d="M0 40 L70 0 L140 40 L70 80 Z" fill="url(#hg-moss)" />
          <path d="M0 40 L0 120 L70 160 L70 80 Z" fill="#14532d" />
          <path d="M70 80 L70 160 L140 120 L140 40 Z" fill="#166534" />
          <circle cx="50" cy="36" r="3" fill="#86efac" opacity="0.7" />
          <circle cx="80" cy="28" r="2.5" fill="#bbf7d0" opacity="0.5" />
          <circle cx="65" cy="50" r="2" fill="#4ade80" opacity="0.6" />
        </g>

        {/* black accent cube */}
        <g transform="translate(320 300)">
          <path d="M0 36 L62 0 L124 36 L62 72 Z" fill="#222" />
          <path d="M0 36 L0 108 L62 144 L62 72 Z" fill="#111" />
          <path d="M62 72 L62 144 L124 108 L124 36 Z" fill="#0a0a0a" />
        </g>

        {/* water cube */}
        <g transform="translate(250 360)">
          <path d="M0 36 L62 0 L124 36 L62 72 Z" fill="url(#hg-water)" />
          <path d="M0 36 L0 108 L62 144 L62 72 Z" fill="#0369a1" />
          <path d="M62 72 L62 144 L124 108 L124 36 Z" fill="#0284c7" />
          <path
            d="M20 40 Q40 28 55 42 T90 38"
            stroke="#e0f2fe"
            strokeWidth="2"
            opacity="0.55"
            filter="url(#hg-soft)"
          />
        </g>

        {/* white cube */}
        <g transform="translate(390 250)">
          <path d="M0 32 L56 0 L112 32 L56 64 Z" fill="#f8f8f8" />
          <path d="M0 32 L0 96 L56 128 L56 64 Z" fill="#d4d4d4" />
          <path d="M56 64 L56 128 L112 96 L112 32 Z" fill="#e8e8e8" />
        </g>

        {/* iridescent face cube */}
        <g transform="translate(420 340)">
          <path d="M0 32 L56 0 L112 32 L56 64 Z" fill="url(#hg-iridescent)" />
          <path d="M0 32 L0 96 L56 128 L56 64 Z" fill="#1e1b4b" />
          <path d="M56 64 L56 128 L112 96 L112 32 Z" fill="#312e81" />
        </g>

        {/* chrome / liquid cube */}
        <g transform="translate(150 380)">
          <path d="M0 28 L48 0 L96 28 L48 56 Z" fill="url(#hg-chrome)" />
          <path d="M0 28 L0 84 L48 112 L48 56 Z" fill="#222" />
          <path d="M48 56 L48 112 L96 84 L96 28 Z" fill="#111" />
        </g>

        {/* black cube accent */}
        <g transform="translate(300 220)">
          <path d="M0 24 L42 0 L84 24 L42 48 Z" fill="#111" />
          <path d="M0 24 L0 72 L42 96 L42 48 Z" fill="#000" />
          <path d="M42 48 L42 96 L84 72 L84 24 Z" fill="#1a1a1a" />
        </g>
      </svg>

      {/* floating pixel accents */}
      <div className="absolute right-[8%] top-[6%] flex flex-col items-end gap-1.5">
        <div className="size-2.5 bg-[#3b82f6]" />
        <div
          className="h-16 w-2.5"
          style={{
            background:
              'linear-gradient(180deg,#3b82f6,#a855f7,#f97316,#facc15)',
          }}
        />
        <div className="h-10 w-2 bg-[#222]" />
      </div>
    </div>
  )
}

export function PixelAccent({
  variant = 'default',
  className = '',
}: {
  variant?: 'default' | 'warm' | 'cool'
  className?: string
}) {
  return (
    <div
      className={`pixel-mark ${variant === 'warm' ? 'warm' : ''} ${variant === 'cool' ? 'cool' : ''} ${className}`}
      aria-hidden
    >
      <div className="pixels">
        <span />
        <span />
        <span />
      </div>
      <div className="bar" />
    </div>
  )
}
