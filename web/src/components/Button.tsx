import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warm'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none'

    const variants: Record<Variant, string> = {
      primary:
        'bg-accent-500 hover:bg-accent-600 text-white shadow-sm focus-visible:ring-accent-400',
      secondary:
        'bg-elevated border border-base text-base hover:bg-card focus-visible:ring-accent-400',
      ghost:
        'text-muted hover:text-base hover:bg-elevated focus-visible:ring-accent-400',
      danger:
        'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 focus-visible:ring-red-400',
      warm:
        'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/30 focus-visible:ring-orange-400',
    }

    const sizes: Record<Size, string> = {
      sm: 'h-7 px-2.5 text-xs',
      md: 'h-8 px-3 text-sm',
      lg: 'h-10 px-4 text-sm',
      icon: 'h-8 w-8 p-0',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? <Spinner size={size === 'lg' ? 16 : 14} /> : children}
      </button>
    )
  },
)
Button.displayName = 'Button'

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}
