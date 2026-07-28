import { cn } from '#/lib/utils'

type Point = { day: string; usdc: number }

export function UsageChart({
  className,
  data,
}: {
  className?: string
  data: Point[]
}) {
  if (!data.length) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        No spend data yet.
      </p>
    )
  }

  const max = Math.max(...data.map((d) => d.usdc), 0.000001)
  const w = 640
  const h = 160
  const padX = 8
  const padY = 16
  const innerW = w - padX * 2
  const innerH = h - padY * 2

  const points = data.map((d, i) => {
    const x = padX + (i / Math.max(data.length - 1, 1)) * innerW
    const y = padY + innerH - (d.usdc / max) * innerH
    return { ...d, x, y }
  })

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const area = `${path} L ${points[points.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-40 w-full min-w-[280px]"
        role="img"
        aria-label="USDC spend over the last 14 days"
      >
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(212,245,66)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(212,245,66)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spendFill)" />
        <path
          d={path}
          fill="none"
          stroke="rgb(212,245,66)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p) => (
          <circle
            key={p.day}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="rgb(10,10,10)"
            stroke="rgb(212,245,66)"
            strokeWidth="1.5"
          >
            <title>
              {p.day}: {p.usdc} USDC
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.day}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  )
}
