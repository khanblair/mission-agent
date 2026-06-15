import { clsx } from 'clsx'

interface Tab<T extends string> {
  id: T
  label: string
  icon?: React.ReactNode
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[]
  active: T
  onChange: (t: T) => void
  size?: 'sm' | 'md'
  className?: string
}

export function Tabs<T extends string>({ tabs, active, onChange, size = 'md', className }: TabsProps<T>) {
  return (
    <div className={clsx('flex items-center gap-0.5 p-0.5 bg-card rounded-lg border border-base', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'flex items-center gap-1.5 rounded-md font-medium transition-all duration-150',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs',
            active === tab.id
              ? 'bg-surface text-base shadow-sm'
              : 'text-muted hover:text-base',
          )}
        >
          {tab.icon && <span className="w-3.5 h-3.5">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
