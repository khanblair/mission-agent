import { ChevronDown, Code2, Cpu, Info, PauseCircle, PlayCircle, StopCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { api } from '../../lib/api'
import { Badge } from '../../components/Badge'
import type { EngineStatus } from '../../types'

export function ControlBar() {
  const { isRunning, scriptVisible, toggleScript, lastRunResult } = useStore()
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null)

  useEffect(() => {
    api.engine.status().then(setEngineStatus).catch(() => null)
  }, [])

  return (
    <div className="flex items-center justify-between px-4 h-10 border-t border-base bg-surface shrink-0">
      {/* Left: engine status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Cpu size={12} className="text-muted" />
          {engineStatus ? (
            <Badge variant={engineStatus.mode === 'real' ? 'accent' : 'mock'} dot>
              {engineStatus.mode === 'real' ? 'GMAT' : 'Mock engine'}
            </Badge>
          ) : (
            <Badge variant="default">Connecting…</Badge>
          )}
        </div>

        {lastRunResult && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted">
            <span>Last run:</span>
            <span className="font-mono text-accent-400">{lastRunResult.run_id.slice(0, 8)}</span>
            {lastRunResult.orbit_summary && (
              <span className="text-muted">
                — {lastRunResult.orbit_summary.alt_mean_km.toFixed(0)} km, {lastRunResult.orbit_summary.period_min.toFixed(1)} min
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        {isRunning && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse-slow" />
            Running simulation…
          </div>
        )}

        <button
          onClick={toggleScript}
          title="Toggle GMAT script view"
          className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-all duration-150 ${
            scriptVisible
              ? 'bg-accent-500/20 text-accent-400 border border-accent-500/40'
              : 'text-muted hover:text-fg hover:bg-elevated border border-transparent'
          }`}
        >
          <Code2 size={12} />
          Script
        </button>
      </div>
    </div>
  )
}
