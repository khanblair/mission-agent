import { BarChart3 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Badge } from '../../components/Badge'
import { PanelRow } from '../../components/Panel'
import type { OrbitSummary } from '../../types'

export function ReportTable() {
  const { lastRunResult } = useStore()

  if (!lastRunResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
        <BarChart3 size={28} className="text-accent-500/30" />
        <div>
          <p className="text-sm text-muted/60">Orbit report</p>
          <p className="text-xs text-faint mt-1">Run a mission to see numerical results</p>
        </div>
      </div>
    )
  }

  const { orbit_summary: s, mock, validation, elements_sample } = lastRunResult

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full">
      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        {mock && <Badge variant="mock" dot>Mock mode</Badge>}
        {validation?.ok === false && <Badge variant="danger" dot>Validation issues</Badge>}
        {validation?.ok === true && <Badge variant="success" dot>Physics OK</Badge>}
        {validation?.warnings?.map((w, i) => (
          <Badge key={i} variant="warning">{w}</Badge>
        ))}
      </div>

      {/* Orbit summary */}
      {s && <OrbitSummaryCard summary={s} />}

      {/* Delta-v card if available */}
      {elements_sample?.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Initial State</h3>
          <div className="bg-card border border-base rounded-xl overflow-hidden">
            {elements_sample.slice(0, 1).map((row, i) => (
              <div key={i}>
                <PanelRow label="Epoch" value={row.t} />
                <PanelRow label="Altitude" value={`${row.alt.toFixed(2)} km`} mono />
                <PanelRow label="Eccentricity" value={row.ecc.toFixed(6)} mono />
                <PanelRow label="Inclination" value={`${row.inc.toFixed(4)}°`} mono />
                <PanelRow label="RAAN" value={`${row.raan.toFixed(4)}°`} mono />
                <PanelRow label="AOP" value={`${row.aop.toFixed(4)}°`} mono />
                <PanelRow label="True anomaly" value={`${row.ta.toFixed(4)}°`} mono />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Validation details */}
      {(validation?.errors?.length || validation?.warnings?.length) && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Validation</h3>
          <div className="space-y-2">
            {validation.errors?.map((e, i) => (
              <div key={i} className="flex gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="text-red-400 text-xs">✕</span>
                <span className="text-xs text-red-300">{e}</span>
              </div>
            ))}
            {validation.warnings?.map((w, i) => (
              <div key={i} className="flex gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-amber-400 text-xs">⚠</span>
                <span className="text-xs text-amber-300">{w}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function OrbitSummaryCard({ summary: s }: { summary: OrbitSummary }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">Orbit Summary</h3>

      {/* Key stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Mean altitude" value={`${s.alt_mean_km.toFixed(1)}`} unit="km" color="accent" />
        <StatCard label="Period" value={`${s.period_min.toFixed(2)}`} unit="min" color="warm" />
        <StatCard label="Inclination" value={`${s.inc_deg.toFixed(2)}`} unit="°" color="success" />
        <StatCard label="Eccentricity" value={s.ecc_mean.toFixed(5)} unit="" color="default" />
      </div>

      {/* Detail table */}
      <div className="bg-card border border-base rounded-xl overflow-hidden">
        <PanelRow label="Min altitude" value={`${s.alt_min_km.toFixed(2)} km`} mono />
        <PanelRow label="Max altitude" value={`${s.alt_max_km.toFixed(2)} km`} mono />
        <PanelRow label="Δ altitude" value={`${(s.alt_max_km - s.alt_min_km).toFixed(2)} km`} mono />
      </div>
    </section>
  )
}

function StatCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  const textColor = {
    accent: 'text-accent-400',
    warm: 'text-orange-400',
    success: 'text-green-400',
    default: 'text-fg',
  }[color] ?? 'text-fg'

  return (
    <div className="bg-card border border-base rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-1">{label}</p>
      <p className={`text-xl font-semibold font-mono ${textColor}`}>
        {value}
        {unit && <span className="text-sm font-normal text-muted ml-1">{unit}</span>}
      </p>
    </div>
  )
}
