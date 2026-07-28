import { cn } from '#/lib/utils'

const LOGO_SRC = '/assets/brand/logo.svg'
const ICON_SRC = '/assets/brand/icon.png'

export function BrandMark({
  className,
  size = 'md',
  variant = 'wordmark',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  /** `wordmark` = full MicroPay logo; `icon` = green Mi mark only. */
  variant?: 'wordmark' | 'icon'
}) {
  const wordmarkHeights = {
    sm: 'h-6',
    md: 'h-7',
    lg: 'h-14 md:h-20 lg:h-24',
  } as const

  const iconSizes = {
    sm: 'size-6',
    md: 'size-7',
    lg: 'size-12 md:size-16',
  } as const

  if (variant === 'icon') {
    return (
      <img
        src={ICON_SRC}
        alt="MicroPay"
        width={512}
        height={512}
        className={cn(
          'inline-block shrink-0 object-contain',
          iconSizes[size],
          className,
        )}
      />
    )
  }

  return (
    <img
      src={LOGO_SRC}
      alt="MicroPay"
      width={1243}
      height={364}
      className={cn(
        'inline-block w-auto max-w-full object-contain object-left',
        wordmarkHeights[size],
        className,
      )}
    />
  )
}
