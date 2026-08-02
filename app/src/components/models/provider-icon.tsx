import { cn } from '#/lib/utils';

type ProviderIconProps = {
  src: string;
  alt?: string;
  /** Visual size of the outer frame */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const FRAME: Record<NonNullable<ProviderIconProps['size']>, string> = {
  sm: 'size-7',
  md: 'size-9',
  lg: 'size-11',
};


/**
 * Compact Linear-style provider glyph — bordered square, contained logo.
 */
export function ProviderIcon({
  src,
  alt = '',
  size = 'md',
  className,
}: ProviderIconProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-paper shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]',
        FRAME[size],
        className,
      )}
      aria-hidden={alt ? undefined : true}
    >
      <img
        src={src}
        alt={alt}
        className={cn('object-cover', 'size-full')}
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
