import { type HTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  actions?: React.ReactNode
  noPad?: boolean
  variant?: 'default' | 'elevated'
}

export function Panel({ title, actions, noPad, variant = 'default', className, children, ...props }: PanelProps) {
  const bg = variant === 'elevated' ? 'bg-elevated' : 'bg-surface'
  return (
    <div
      className={clsx(
        bg,
        'border border-base rounded-xl flex flex-col overflow-hidden',
        className,
      )}
      {...props}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-base shrink-0">
          {title && (
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">
              {title}
            </span>
          )}
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </div>
      )}
      <div className={clsx('flex-1 overflow-hidden', !noPad && 'p-4')}>{children}</div>
    </div>
  )
}

export function PanelRow({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-subtle last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={clsx('text-xs font-medium text-fg', mono && 'font-mono')}>{value}</span>
    </div>
  )
}
