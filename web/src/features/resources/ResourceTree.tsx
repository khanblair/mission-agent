import { ChevronRight, Globe2, MapPin, Satellite } from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'
import { useStore } from '../../store/useStore'
import { PanelRow } from '../../components/Panel'

export function ResourceTree() {
  const { lastRunResult } = useStore()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ spacecraft: true })

  const toggle = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }))

  // Extract orbital elements from last run
  const elem = lastRunResult?.elements_sample?.[0]
  const summary = lastRunResult?.orbit_summary

  if (!lastRunResult) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
        <Satellite size={24} className="text-accent-500/30" />
        <p className="text-xs text-muted">Resources will appear here after a mission runs.</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-1 overflow-y-auto h-full">
      {/* Spacecraft */}
      <TreeSection
        icon={<Satellite size={13} />}
        label="Spacecraft / SC"
        expanded={expanded.spacecraft}
        onToggle={() => toggle('spacecraft')}
      >
        {summary && (
          <>
            <PanelRow label="Altitude (mean)" value={`${summary.alt_mean_km.toFixed(2)} km`} mono />
            <PanelRow label="Period" value={`${summary.period_min.toFixed(2)} min`} mono />
            <PanelRow label="Inclination" value={`${summary.inc_deg.toFixed(4)}°`} mono />
            <PanelRow label="Eccentricity" value={summary.ecc_mean.toFixed(6)} mono />
          </>
        )}
        {elem && (
          <>
            <PanelRow label="RAAN" value={`${elem.raan.toFixed(4)}°`} mono />
            <PanelRow label="AOP" value={`${elem.aop.toFixed(4)}°`} mono />
            <PanelRow label="True anomaly" value={`${elem.ta.toFixed(4)}°`} mono />
          </>
        )}
      </TreeSection>

      {/* Force model */}
      <TreeSection
        icon={<Globe2 size={13} />}
        label="Force Model"
        expanded={expanded.forces}
        onToggle={() => toggle('forces')}
      >
        <PanelRow label="Gravity" value="Earth J2–J10" />
        <PanelRow label="Atmosphere" value="JacchiaRoberts" />
        <PanelRow label="3rd bodies" value="Luna, Sun" />
        <PanelRow label="SRP" value="On" />
      </TreeSection>

      {/* Propagator */}
      <TreeSection
        icon={<ChevronRight size={13} />}
        label="Propagator"
        expanded={expanded.prop}
        onToggle={() => toggle('prop')}
      >
        <PanelRow label="Type" value="RungeKutta89" mono />
        <PanelRow label="Step size" value="60 s" mono />
        <PanelRow label="Max step" value="2700 s" mono />
      </TreeSection>

      {/* Ground station placeholder */}
      <TreeSection
        icon={<MapPin size={13} />}
        label="Ground Stations"
        expanded={expanded.gs}
        onToggle={() => toggle('gs')}
      >
        <p className="text-xs text-muted px-2 py-1">No ground stations in this run.</p>
      </TreeSection>
    </div>
  )
}

function TreeSection({
  icon, label, expanded, onToggle, children,
}: {
  icon: React.ReactNode
  label: string
  expanded?: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-elevated rounded-lg transition-colors duration-100"
      >
        <ChevronRight
          size={12}
          className={clsx('text-muted transition-transform duration-150', expanded && 'rotate-90')}
        />
        <span className="text-muted">{icon}</span>
        <span className="text-xs font-medium text-fg">{label}</span>
      </button>
      {expanded && (
        <div className="ml-7 mr-2 mb-2 bg-card border border-base rounded-lg overflow-hidden animate-fade-in">
          {children}
        </div>
      )}
    </div>
  )
}
