import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { Plus, Satellite, ChevronLeft, ChevronRight, Settings, FolderOpen } from 'lucide-react'
import { useStore } from './store/useStore'
import { api } from './lib/api'
import { ChatPanel } from './features/chat/ChatPanel'
import { OrbitView } from './features/output/OrbitView'
import { GroundTrack } from './features/output/GroundTrack'
import { ReportTable } from './features/output/ReportTable'
import { ResourceTree } from './features/resources/ResourceTree'
import { SequencePanel } from './features/sequence/SequencePanel'
import { ScriptPanel } from './features/script/ScriptPanel'
import { ControlBar } from './features/controls/ControlBar'
import { ThemeToggle } from './components/ThemeToggle'
import { Tabs } from './components/Tabs'
import { Button } from './components/Button'
import { Spinner } from './components/Spinner'
import type { Mission, OutputTab } from './types'

const OUTPUT_TABS = [
  { id: '3d' as OutputTab, label: '3D Orbit' },
  { id: 'groundtrack' as OutputTab, label: 'Ground Track' },
  { id: 'report' as OutputTab, label: 'Report' },
]

const LEFT_TABS = [
  { id: 'chat', label: 'Chat' },
  { id: 'resources', label: 'Resources' },
  { id: 'sequence', label: 'Sequence' },
]

export default function App() {
  const {
    theme, outputTab, setOutputTab, scriptVisible,
    activeMission, setActiveMission, clearMessages, setCurrentScript,
    sidebarCollapsed, toggleSidebar,
  } = useStore()

  const [missions, setMissions] = useState<Mission[]>([])
  const [loadingMissions, setLoadingMissions] = useState(true)
  const [leftTab, setLeftTab] = useState<'chat' | 'resources' | 'sequence'>('chat')
  const [creating, setCreating] = useState(false)

  // Sync theme class on mount
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(theme)
  }, [])

  // Load missions list
  useEffect(() => {
    api.missions.list()
      .then((list) => {
        setMissions(list)
        if (list.length > 0 && !activeMission) {
          selectMission(list[0])
        }
      })
      .finally(() => setLoadingMissions(false))
  }, [])

  const selectMission = async (m: Mission) => {
    setActiveMission(m)
    clearMessages()
    setCurrentScript(m.script ?? '')
    // Load full mission with messages
    const full = await api.missions.get(m.id)
    setActiveMission(full)
  }

  const createMission = async () => {
    setCreating(true)
    try {
      const name = `Mission ${missions.length + 1}`
      const m = await api.missions.create(name)
      setMissions((prev) => [m, ...prev])
      selectMission(m)
    } finally {
      setCreating(false)
    }
  }

  const missionId = activeMission?.id ?? 'default'

  return (
    <div className="flex flex-col h-screen bg-[hsl(var(--bg))] text-base overflow-hidden">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-4 h-11 border-b border-base bg-surface shrink-0 z-10">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-500/10 border border-accent-500/30 flex items-center justify-center">
              <Satellite size={14} className="text-accent-400" />
            </div>
            <span className="text-sm font-semibold text-base tracking-tight">Mission Agent</span>
          </div>

          <div className="w-px h-4 bg-border" />

          {/* Mission selector */}
          <div className="flex items-center gap-2">
            {loadingMissions ? (
              <Spinner size={14} />
            ) : activeMission ? (
              <span className="text-sm text-muted">{activeMission.name}</span>
            ) : (
              <span className="text-sm text-faint italic">No mission</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={createMission} loading={creating}>
            <Plus size={13} />
            New mission
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Main workspace ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: missions sidebar */}
        <div
          className={clsx(
            'border-r border-base bg-surface flex flex-col shrink-0 transition-all duration-200',
            sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-52',
          )}
        >
          <div className="px-3 py-2.5 border-b border-base flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
              <FolderOpen size={11} />
              Missions
            </div>
            <Button variant="ghost" size="icon" onClick={createMission} loading={creating} title="New mission">
              <Plus size={12} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {missions.map((m) => (
              <button
                key={m.id}
                onClick={() => selectMission(m)}
                className={clsx(
                  'w-full text-left px-3 py-2 text-xs transition-colors duration-100 rounded-lg mx-1',
                  activeMission?.id === m.id
                    ? 'bg-accent-500/10 text-accent-400 font-medium'
                    : 'text-muted hover:text-base hover:bg-elevated',
                )}
                style={{ width: 'calc(100% - 8px)' }}
              >
                <div className="truncate">{m.name}</div>
                <div className="text-[10px] text-faint mt-0.5">
                  {new Date(m.created_at).toLocaleDateString()}
                </div>
              </button>
            ))}
            {missions.length === 0 && !loadingMissions && (
              <p className="text-xs text-faint text-center py-6 px-3">No missions yet. Create one to get started.</p>
            )}
          </div>
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={toggleSidebar}
          className="w-4 border-r border-base bg-surface hover:bg-elevated flex items-center justify-center text-muted hover:text-base transition-colors duration-100 shrink-0"
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
        </button>

        {/* Center: output panels */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Output tab bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-base bg-surface shrink-0">
            <Tabs tabs={OUTPUT_TABS} active={outputTab} onChange={setOutputTab} size="sm" />
            {scriptVisible && (
              <span className="text-[10px] text-muted italic">Script view active</span>
            )}
          </div>

          {/* Output content */}
          <div className="flex-1 overflow-hidden relative">
            <div className={clsx('absolute inset-0 transition-opacity duration-200', outputTab === '3d' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none')}>
              <OrbitView />
            </div>
            <div className={clsx('absolute inset-0 transition-opacity duration-200', outputTab === 'groundtrack' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none')}>
              <GroundTrack />
            </div>
            <div className={clsx('absolute inset-0 overflow-y-auto transition-opacity duration-200', outputTab === 'report' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none')}>
              <ReportTable />
            </div>
          </div>

          {/* Script panel (sliding overlay) */}
          {scriptVisible && (
            <div className="h-72 border-t border-base shrink-0 animate-slide-in">
              <ScriptPanel />
            </div>
          )}

          {/* Control bar */}
          <ControlBar />
        </div>

        {/* Right column: chat / resources / sequence */}
        <div className="w-80 border-l border-base bg-surface flex flex-col shrink-0 overflow-hidden">
          {/* Tab bar */}
          <div className="px-3 py-2 border-b border-base shrink-0">
            <Tabs
              tabs={LEFT_TABS as { id: 'chat' | 'resources' | 'sequence'; label: string }[]}
              active={leftTab}
              onChange={setLeftTab}
              size="sm"
              className="w-full justify-around"
            />
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {leftTab === 'chat' && <ChatPanel missionId={missionId} />}
            {leftTab === 'resources' && (
              <div className="h-full overflow-y-auto">
                <ResourceTree />
              </div>
            )}
            {leftTab === 'sequence' && (
              <div className="h-full overflow-y-auto">
                <SequencePanel />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
