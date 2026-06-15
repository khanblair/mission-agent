import { Check, Copy, FileCode } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { Button } from '../../components/Button'

export function ScriptPanel() {
  const { currentScript } = useStore()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!currentScript) return
    await navigator.clipboard.writeText(currentScript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--bg))]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-base shrink-0">
        <div className="flex items-center gap-2">
          <FileCode size={13} className="text-accent-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">GMAT Script</span>
        </div>
        {currentScript && (
          <Button variant="ghost" size="sm" onClick={copy}>
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
      </div>

      {currentScript ? (
        <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono leading-relaxed text-[hsl(var(--text-muted))] whitespace-pre">
          {highlight(currentScript)}
        </pre>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
          <FileCode size={24} className="text-accent-500/20" />
          <p className="text-xs text-muted">The generated GMAT script will appear here. Ask the agent to design a mission to see it.</p>
        </div>
      )}
    </div>
  )
}

function highlight(script: string): React.ReactNode {
  const lines = script.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('%')) {
      return <span key={i} className="text-[hsl(var(--text-faint))] italic">{line}{'\n'}</span>
    }
    if (/^(Create|BeginMissionSequence|EndMissionSequence|Propagate|Maneuver|Target|EndTarget|Vary|Achieve|Optimize|EndOptimize)\b/.test(line.trim())) {
      return <span key={i} className="text-accent-400">{line}{'\n'}</span>
    }
    if (/^GMAT\s/.test(line.trim())) {
      const parts = line.match(/^(\s*GMAT\s+\S+\s*=\s*)(.+)$/)
      if (parts) {
        return (
          <span key={i}>
            <span className="text-[hsl(var(--text-muted))]">{parts[1]}</span>
            <span className="text-orange-400/80">{parts[2]}</span>
            {'\n'}
          </span>
        )
      }
    }
    return <span key={i} className="text-[hsl(var(--text-muted))]">{line}{'\n'}</span>
  })
}
