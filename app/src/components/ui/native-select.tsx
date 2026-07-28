import { cn } from '#/lib/utils'

type Option = { value: string; label: string }

type Props = {
  value: string
  onValueChange: (value: string) => void
  options: Option[]
  className?: string
  'aria-label'?: string
}

export function NativeSelect({
  value,
  onValueChange,
  options,
  className,
  'aria-label': ariaLabel,
}: Props) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={cn(
        'h-9 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-40',
        className,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
