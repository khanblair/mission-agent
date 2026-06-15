import { List, Rocket } from 'lucide-react'
import { useStore } from '../../store/useStore'

const SEQUENCE_PATTERNS = [
  { cmd: 'Propagate', args: 'Prop(SC)', condition: 'ElapsedDays = N', color: 'accent' },
  { cmd: 'Maneuver', args: 'DVA(SC)', condition: 'Impulsive burn', color: 'warm' },
  { cmd: 'Target', args: 'DC', condition: 'Differential corrector', color: 'success' },
  { cmd: 'Report', args: 'EphRpt', condition: 'Write ephemeris', color: 'default' },
]

const COLORS: Record<string, string> = {
  accent: 'bg-accent-500/10 border-accent-500/30 text-accent-400',
  warm: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  success: 'bg-green-500/10 border-green-500/30 text-green-400',
  default: 'bg-elevated border-base text-muted',
}

export function SequencePanel() {
  const { currentScript } = useStore()

  // Parse mission sequence commands from the script
  const commands = parseSequence(currentScript)

  if (!currentScript) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
        <List size={24} className="text-accent-500/30" />
        <p className="text-xs text-muted">Mission sequence commands will appear here once a script is generated.</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2 overflow-y-auto h-full">
      <div className="flex items-center gap-2 px-1 mb-3">
        <Rocket size={12} className="text-accent-400" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Mission Sequence</span>
      </div>

      {commands.length === 0 ? (
        <p className="text-xs text-muted px-2">No commands found after BeginMissionSequence.</p>
      ) : (
        <div className="space-y-2">
          {commands.map((cmd, i) => (
            <SequenceStep key={i} index={i + 1} command={cmd} />
          ))}
        </div>
      )}
    </div>
  )
}

function SequenceStep({ index, command }: { index: number; command: ParsedCommand }) {
  const colorClass = COLORS[command.type] ?? COLORS.default

  return (
    <div className="flex items-start gap-3">
      {/* Step number + connector */}
      <div className="flex flex-col items-center shrink-0">
        <div className="w-6 h-6 rounded-full border border-base bg-card flex items-center justify-center">
          <span className="text-[9px] font-mono text-muted">{index}</span>
        </div>
        <div className="w-px flex-1 bg-border-subtle mt-1 min-h-[8px]" />
      </div>

      {/* Command card */}
      <div className={`flex-1 rounded-lg border px-3 py-2 mb-2 ${colorClass}`}>
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold font-mono">{command.keyword}</span>
          <span className="text-[11px] opacity-70 font-mono truncate">{command.args}</span>
        </div>
        {command.condition && (
          <p className="text-[10px] opacity-60 mt-0.5">Stop: {command.condition}</p>
        )}
      </div>
    </div>
  )
}

interface ParsedCommand {
  keyword: string
  args: string
  condition: string
  type: string
}

function parseSequence(script: string): ParsedCommand[] {
  if (!script) return []
  const seqMatch = script.match(/BeginMissionSequence;([\s\S]*)$/i)
  if (!seqMatch) return []

  const body = seqMatch[1]
  const lines = body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('%'))

  return lines.map((line) => {
    const keyword = line.split(/[\s(]/)[0]
    const condMatch = line.match(/\{([^}]+)\}/)
    const condition = condMatch ? condMatch[1] : ''
    const argsMatch = line.match(/\(([^)]+)\)/)
    const args = argsMatch ? argsMatch[1] : ''

    let type = 'default'
    if (/^Propagate/i.test(keyword)) type = 'accent'
    else if (/^Maneuver/i.test(keyword)) type = 'warm'
    else if (/^Target|^Optimize/i.test(keyword)) type = 'success'

    return { keyword, args, condition, type }
  }).filter((c) => c.keyword)
}
