import { useEffect, useState, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  Plus, Satellite, ChevronLeft, ChevronRight, FolderOpen,
  Pencil, Trash2, Check, X,
} from 'lucide-react'
import { useStore } from './store/useStore'
import { api } from './lib/api'
import { ConfirmDialog } from './components/ConfirmDialog'
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

const RIGHT_TABS = [
  { id: 'chat', label: 'Chat' },
  { id: 'resources', label: 'Resources' },
  { id: 'sequence', label: 'Sequence' },
]

export default function App() {
  const {
    theme, outputTab, setOutputTab, scriptVisible,
    activeMission, setActiveMission, clearMessages, setCurrentScript,
    setLastRunResult, sidebarCollapsed, toggleSidebar,
    setSessions, setActiveSession,
  } = useStore()

  const [missions, setMissions] = useState<Mission[]>([])
  const [loadingMissions, setLoadingMissions] = useState(true)
  const [rightTab, setRightTab] = useState<'chat' | 'resources' | 'sequence'>('chat')
  const [creating, setCreating] = useState(false)

  // Sidebar widths (px)
  const [leftWidth, setLeftWidth] = useState(208)   // default w-52
  const [rightWidth, setRightWidth] = useState(320) // default w-80
  const [rightCollapsed, setRightCollapsed] = useState(false)

  // Mission CRUD state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmDeleteMission, setConfirmDeleteMission] = useState<Mission | null>(null)

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
    setCurrentScript('')
    setLastRunResult(null)
    setSessions([])
    setActiveSession(null)

    const [full, runs] = await Promise.all([
      api.missions.get(m.id),
      api.missions.runs(m.id),
    ])
    setActiveMission(full)

    const latest = runs.find((r) => r.status === 'completed' && r.result)
    if (latest?.result) setLastRunResult(latest.result)
    setCurrentScript(full.script ?? latest?.result?.script ?? '')
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

  // ── Mission edit ──────────────────────────────────────────────
  const startEdit = (m: Mission, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(m.id)
    setEditingName(m.name)
  }

  const saveEdit = useCallback(async () => {
    if (!editingId) return
    const name = editingName.trim() || 'Unnamed Mission'
    setEditingId(null)
    await api.missions.update(editingId, { name })
    setMissions((prev) => prev.map((m) => m.id === editingId ? { ...m, name } : m))
    if (activeMission?.id === editingId) setActiveMission({ ...activeMission, name })
  }, [editingId, editingName, activeMission, setActiveMission])

  const cancelEdit = () => setEditingId(null)

  // ── Mission delete ────────────────────────────────────────────
  const requestDeleteMission = useCallback((m: Mission, e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmDeleteMission(m)
  }, [])

  const confirmDoDeleteMission = useCallback(async () => {
    if (!confirmDeleteMission) return
    const id = confirmDeleteMission.id
    setConfirmDeleteMission(null)
    await api.missions.delete(id)
    const remaining = missions.filter((m) => m.id !== id)
    setMissions(remaining)
    if (activeMission?.id === id) {
      if (remaining.length > 0) await selectMission(remaining[0])
      else {
        setActiveMission(null)
        setCurrentScript('')
        setLastRunResult(null)
        clearMessages()
      }
    }
  }, [confirmDeleteMission, missions, activeMission])

  // ── Left sidebar drag-resize ──────────────────────────────────
  const startLeftResize = useCallback((e: React.MouseEvent) => {
    if (sidebarCollapsed) { toggleSidebar(); return }
    e.preventDefault()
    const startX = e.clientX
    const startW = leftWidth
    let moved = false

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX
      if (!moved && Math.abs(delta) > 3) moved = true
      if (moved) setLeftWidth(Math.max(120, Math.min(400, startW + delta)))
    }
    const onUp = () => {
      if (!moved) toggleSidebar()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarCollapsed, leftWidth, toggleSidebar])

  // ── Right panel drag-resize ───────────────────────────────────
  const startRightResize = useCallback((e: React.MouseEvent) => {
    if (rightCollapsed) { setRightCollapsed(false); return }
    e.preventDefault()
    const startX = e.clientX
    const startW = rightWidth
    let moved = false

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX
      if (!moved && Math.abs(delta) > 3) moved = true
      // Panel grows leftward: dragging left increases width
      if (moved) setRightWidth(Math.max(240, Math.min(600, startW - delta)))
    }
    const onUp = () => {
      if (!moved) setRightCollapsed((c) => !c) // no drag = toggle collapse
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [rightCollapsed, rightWidth])

  const missionId = activeMission?.id ?? 'default'

  return (
    <div className="flex flex-col h-screen bg-[hsl(var(--bg))] text-fg overflow-hidden">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-4 h-11 border-b border-base bg-surface shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-500/10 border border-accent-500/30 flex items-center justify-center">
              <Satellite size={14} className="text-accent-400" />
            </div>
            <span className="text-sm font-semibold text-fg tracking-tight">Mission Agent</span>
          </div>

          <div className="w-px h-4 bg-border" />

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

        {/* Left sidebar: missions list */}
        <div
          className="border-r border-base bg-surface flex flex-col shrink-0 overflow-hidden transition-[width] duration-200"
          style={{ width: sidebarCollapsed ? 0 : leftWidth }}
        >
          <div className="px-3 py-2.5 border-b border-base flex items-center justify-between shrink-0">
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
              editingId === m.id ? (
                /* ── Inline rename input ── */
                <div
                  key={m.id}
                  className="flex items-center gap-1 px-2 py-1.5 mx-1"
                  style={{ width: 'calc(100% - 8px)' }}
                >
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit()
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    onBlur={saveEdit}
                    autoFocus
                    className="flex-1 min-w-0 bg-elevated border border-accent-500/40 rounded px-1.5 py-0.5 text-xs text-fg outline-none focus:border-accent-500"
                  />
                  <button onClick={saveEdit} className="p-0.5 text-success hover:opacity-70 transition-opacity shrink-0">
                    <Check size={11} />
                  </button>
                  <button onClick={cancelEdit} className="p-0.5 text-muted hover:text-danger transition-colors shrink-0">
                    <X size={11} />
                  </button>
                </div>
              ) : (
                /* ── Normal mission row ── */
                <button
                  key={m.id}
                  onClick={() => selectMission(m)}
                  className={clsx(
                    'group relative w-full text-left px-3 py-2 text-xs transition-colors duration-100 rounded-lg mx-1',
                    activeMission?.id === m.id
                      ? 'bg-accent-500/10 text-accent-400 font-medium'
                      : 'text-muted hover:text-fg hover:bg-elevated',
                  )}
                  style={{ width: 'calc(100% - 8px)' }}
                >
                  <div className="truncate pr-10">{m.name}</div>
                  <div className="text-[10px] text-faint mt-0.5">
                    {new Date(m.created_at).toLocaleDateString()}
                  </div>
                  {/* Edit / Delete — reveal on row hover */}
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-inherit">
                    <button
                      onClick={(e) => startEdit(m, e)}
                      title="Rename"
                      className="p-1 rounded hover:bg-card text-faint hover:text-fg transition-colors"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      onClick={(e) => requestDeleteMission(m, e)}
                      title="Delete"
                      className="p-1 rounded hover:bg-card text-faint hover:text-danger transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </button>
              )
            ))}
            {missions.length === 0 && !loadingMissions && (
              <p className="text-xs text-faint text-center py-6 px-3">
                No missions yet. Create one to get started.
              </p>
            )}
          </div>
        </div>

        {/* Left resize / collapse handle */}
        <div
          className="relative w-4 shrink-0 border-r border-base bg-surface hover:bg-elevated flex items-center justify-center cursor-col-resize select-none group transition-colors"
          onMouseDown={startLeftResize}
          title={sidebarCollapsed ? 'Show sidebar' : 'Drag to resize · Click to hide'}
        >
          {/* Drag indicator line */}
          <div className="absolute inset-y-8 w-0.5 left-1.5 rounded-full bg-border group-hover:bg-accent-500/50 transition-colors" />
          {sidebarCollapsed
            ? <ChevronRight size={10} className="text-muted group-hover:text-fg transition-colors relative z-10" />
            : <ChevronLeft size={10} className="text-muted group-hover:text-fg transition-colors relative z-10" />}
        </div>

        {/* Center: output panels */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
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

          <ControlBar />
        </div>

        {/* Right resize / collapse handle */}
        <div
          className="relative w-4 shrink-0 border-l border-base bg-surface hover:bg-elevated flex items-center justify-center cursor-col-resize select-none group transition-colors"
          onMouseDown={startRightResize}
          title={rightCollapsed ? 'Show panel' : 'Drag to resize · Click to hide'}
        >
          <div className="absolute inset-y-8 w-0.5 right-1.5 rounded-full bg-border group-hover:bg-accent-500/50 transition-colors" />
          {rightCollapsed
            ? <ChevronLeft size={10} className="text-muted group-hover:text-fg transition-colors relative z-10" />
            : <ChevronRight size={10} className="text-muted group-hover:text-fg transition-colors relative z-10" />}
        </div>

        {/* Right column: chat / resources / sequence */}
        <div
          className="border-l border-base bg-surface flex flex-col shrink-0 overflow-hidden transition-[width] duration-200"
          style={{ width: rightCollapsed ? 0 : rightWidth }}
        >
          {/* Tab bar with collapse button */}
          <div className="px-3 py-2 border-b border-base shrink-0 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Tabs
                tabs={RIGHT_TABS as { id: 'chat' | 'resources' | 'sequence'; label: string }[]}
                active={rightTab}
                onChange={setRightTab}
                size="sm"
                className="w-full justify-around"
              />
            </div>
            <button
              onClick={() => setRightCollapsed(true)}
              title="Collapse panel"
              className="p-1 rounded text-muted hover:text-fg hover:bg-elevated transition-colors shrink-0"
            >
              <ChevronRight size={12} />
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden">
            {rightTab === 'chat' && <ChatPanel missionId={missionId} />}
            {rightTab === 'resources' && (
              <div className="h-full overflow-y-auto">
                <ResourceTree />
              </div>
            )}
            {rightTab === 'sequence' && (
              <div className="h-full overflow-y-auto">
                <SequencePanel />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mission delete confirmation */}
      {confirmDeleteMission && (
        <ConfirmDialog
          title="Delete mission"
          message={`"${confirmDeleteMission.name}" and all its runs, scripts, and chat history will be permanently deleted.`}
          confirmLabel="Delete mission"
          onConfirm={confirmDoDeleteMission}
          onCancel={() => setConfirmDeleteMission(null)}
        />
      )}
    </div>
  )
}
