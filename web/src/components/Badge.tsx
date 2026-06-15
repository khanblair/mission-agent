import { clsx } from 'clsx'

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'mock'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  dot?: boolean
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  default:  'bg-elevated text-muted border-base',
  accent:   'bg-accent-500/10 text-accent-400 border-accent-500/30',
  success:  'bg-green-500/10 text-green-400 border-green-500/30',
  warning:  'bg-amber-500/10 text-amber-400 border-amber-500/30',
  danger:   'bg-red-500/10 text-red-400 border-red-500/30',
  mock:     'bg-violet-500/10 text-violet-400 border-violet-500/30',
}

const dotColors: Record<BadgeVariant, string> = {
  default:  'bg-[hsl(var(--text-faint))]',
  accent:   'bg-accent-400',
  success:  'bg-green-400',
  warning:  'bg-amber-400',
  danger:   'bg-red-400',
  mock:     'bg-violet-400',
}

export function Badge({ children, variant = 'default', dot, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium border',
        variants[variant],
        className,
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  )
}
