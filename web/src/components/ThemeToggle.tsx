import { Moon, Sun } from 'lucide-react'
import { useStore } from '../store/useStore'

export function ThemeToggle() {
  const { theme, toggleTheme } = useStore()

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="h-8 w-8 flex items-center justify-center rounded-lg border border-base bg-elevated text-muted hover:text-fg hover:bg-card transition-all duration-150"
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  )
}
