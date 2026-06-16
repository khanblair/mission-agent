import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, Bot, MessageSquarePlus, Pencil, Satellite, Trash2, User, X, Zap, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { useStore } from '../../store/useStore'
import { useAgentWs } from '../../lib/ws'
import { api } from '../../lib/api'
import { Badge } from '../../components/Badge'
import { LoadingDots } from '../../components/Spinner'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { ChatSession, RunResult, WsEvent } from '../../types'

const SUGGESTIONS = [
  'Design a 550 km sun-synchronous orbit',
  'Compute contact windows over New York for my LEO satellite',
  'Plan a Hohmann transfer from 400 km to 600 km',
  'How long will a 350 km orbit last before reentry?',
]

export function ChatPanel({ missionId }: { missionId: string }) {
  const {
    messages, addMessage, appendToLastAssistant, setMessages,
    setLastRunResult, setCurrentScript, isRunning, setIsRunning,
    sessions, setSessions, activeSession, setActiveSession,
  } = useStore()

  const [input, setInput] = useState('')
  const [wsErr, setWsErr] = useState<string | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<ChatSession | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sessionTabsRef = useRef<HTMLDivElement>(null)

  // ── Load (or create) sessions for this mission ───────────────
  // This runs whenever the active mission changes. We always resolve
  // to a valid session BEFORE the WebSocket tries to connect, so the
  // WS never fires with sessionId=null and never auto-creates sessions.
  useEffect(() => {
    if (missionId === 'default') return
    let cancelled = false

    async function init() {
      const list = await api.sessions.list(missionId)
      if (cancelled) return

      if (list.length > 0) {
        setSessions(list)
        const last = list[list.length - 1]
        // Only switch if we're not already on a session from this mission
        if (!activeSession || activeSession.mission_id !== missionId) {
          await loadSession(last)
        }
      } else {
        // No sessions yet — create one now so the WS always has a valid ID
        const fresh = await api.sessions.create(missionId)
        if (cancelled) return
        setSessions([fresh])
        setActiveSession(fresh)
        setMessages([])
      }
    }

    init()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId])

  // ── Load a session's messages ─────────────────────────────────
  const loadSession = async (session: ChatSession) => {
    setActiveSession(session)
    const full = await api.sessions.get(missionId, session.id)
    setMessages((full.messages ?? []).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })))
  }

  // ── Create new session ────────────────────────────────────────
  const newSession = async () => {
    const s = await api.sessions.create(missionId)
    setSessions([...sessions, s])
    setActiveSession(s)
    setMessages([])
    // Scroll tab strip to end
    setTimeout(() => {
      if (sessionTabsRef.current) {
        sessionTabsRef.current.scrollLeft = sessionTabsRef.current.scrollWidth
      }
    }, 50)
  }

  // ── Rename session ────────────────────────────────────────────
  const startRename = (s: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSessionId(s.id)
    setEditingName(s.name)
  }

  const saveRename = async () => {
    if (!editingSessionId) return
    const name = editingName.trim() || 'New Chat'
    setEditingSessionId(null)
    const updated = await api.sessions.update(missionId, editingSessionId, name)
    setSessions(sessions.map((s) => s.id === editingSessionId ? updated : s))
    if (activeSession?.id === editingSessionId) setActiveSession(updated)
  }

  // ── Delete session ────────────────────────────────────────────
  const deleteSession = async (s: ChatSession) => {
    setConfirmDelete(null)
    await api.sessions.delete(missionId, s.id)
    const remaining = sessions.filter((x) => x.id !== s.id)
    setSessions(remaining)
    if (activeSession?.id === s.id) {
      if (remaining.length > 0) await loadSession(remaining[remaining.length - 1])
      else { setActiveSession(null); setMessages([]) }
    }
  }

  // ── WebSocket callbacks ───────────────────────────────────────
  const onChunk = useCallback((chunk: string) => {
    appendToLastAssistant(chunk)
  }, [appendToLastAssistant])

  const onDone = useCallback((evt: WsEvent & { type: 'done' }) => {
    setIsRunning(false)
    if (evt.run_data) {
      setLastRunResult(evt.run_data as RunResult)
      if ((evt.run_data as RunResult).script) setCurrentScript((evt.run_data as RunResult).script!)
    }
  }, [setIsRunning, setLastRunResult, setCurrentScript])

  const onError = useCallback((msg: string) => {
    setIsRunning(false)
    setWsErr(msg)
  }, [setIsRunning])

  const onOpen = useCallback(() => { setWsErr(null) }, [])

  const { status, send } = useAgentWs({
    missionId,
    sessionId: activeSession?.id ?? null,
    onChunk, onDone, onError, onOpen,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isRunning || status !== 'open') return
    addMessage({ role: 'user', content: text })
    addMessage({ role: 'assistant', content: '' })
    setInput('')
    setIsRunning(true)
    setWsErr(null)
    send(text)
    // Optimistically update session name if it's still "New Chat"
    if (activeSession?.name === 'New Chat') {
      const autoName = text.slice(0, 40)
      setSessions(sessions.map((s) =>
        s.id === activeSession.id ? { ...s, name: autoName } : s
      ))
      setActiveSession({ ...activeSession, name: autoName })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const wsColor = status === 'open' ? 'success' : status === 'error' ? 'danger' : 'warning'
  const wsLabel = status === 'open' ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Disconnected'

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-base shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-accent-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">AI Agent</span>
        </div>
        <Badge variant={wsColor} dot>{wsLabel}</Badge>
      </div>

      {/* ── Session tab strip ── */}
      <div className="border-b border-base shrink-0 bg-card">
        <div className="flex items-center">
          {/* Scrollable tabs */}
          <div
            ref={sessionTabsRef}
            className="flex-1 flex items-center gap-0.5 overflow-x-auto px-2 py-1.5 scrollbar-none"
            style={{ scrollbarWidth: 'none' }}
          >
            {sessions.map((s) => (
              <div
                key={s.id}
                className={clsx(
                  'group flex items-center gap-1 shrink-0 rounded-md px-2 py-1 text-[11px] max-w-[140px] cursor-pointer transition-colors',
                  activeSession?.id === s.id
                    ? 'bg-elevated text-fg font-medium border border-accent-500/30'
                    : 'text-muted hover:text-fg hover:bg-elevated/60',
                )}
                onClick={() => { if (activeSession?.id !== s.id) loadSession(s) }}
              >
                {editingSessionId === s.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRename()
                      if (e.key === 'Escape') setEditingSessionId(null)
                    }}
                    onBlur={saveRename}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    className="w-20 bg-transparent outline-none border-b border-accent-500/50 text-[11px] text-fg"
                  />
                ) : (
                  <>
                    <span className="truncate">{s.name}</span>
                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => startRename(s, e)}
                        className="p-0.5 rounded hover:text-fg transition-colors"
                        title="Rename"
                      >
                        <Pencil size={9} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(s) }}
                        className="p-0.5 rounded hover:text-danger transition-colors"
                        title="Delete"
                      >
                        <X size={9} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {sessions.length === 0 && (
              <span className="text-[10px] text-faint px-1">No sessions yet</span>
            )}
          </div>

          {/* New session button */}
          <button
            onClick={newSession}
            title="New chat session"
            className="shrink-0 p-2 text-muted hover:text-fg hover:bg-elevated transition-colors border-l border-base"
          >
            <MessageSquarePlus size={13} />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-2 border-accent-500/30 flex items-center justify-center">
                <Satellite size={24} className="text-accent-400" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent-500/20 border border-accent-500/40 flex items-center justify-center">
                <Zap size={8} className="text-accent-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-fg mb-1">Mission Agent ready</p>
              <p className="text-xs text-muted max-w-[220px] leading-relaxed">
                Describe your mission in plain language. I'll design the orbit, run the simulation, and explain the results.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-left px-3 py-2 rounded-lg border border-base bg-card hover:bg-elevated hover:border-accent-500/40 text-xs text-muted hover:text-fg transition-all duration-150"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            role={msg.role}
            content={msg.content}
            isStreaming={isRunning && i === messages.length - 1 && msg.role === 'assistant' && msg.content === ''}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Error banner ── */}
      {wsErr && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {wsErr}
        </div>
      )}

      {/* ── Input ── */}
      <div className="px-4 pb-4 shrink-0">
        <div className={clsx(
          'flex items-end gap-2 rounded-xl border bg-card p-2 transition-colors duration-150',
          status === 'open' ? 'border-base focus-within:border-accent-500/50' : 'border-base opacity-70',
        )}>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your mission…"
            disabled={isRunning || status !== 'open'}
            className="flex-1 resize-none bg-transparent text-sm text-fg placeholder:text-muted outline-none min-h-[32px] max-h-[120px] overflow-y-auto leading-relaxed py-1 px-1 disabled:opacity-50"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isRunning || status !== 'open'}
            className={clsx(
              'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150',
              input.trim() && !isRunning && status === 'open'
                ? 'bg-accent-500 hover:bg-accent-600 text-white shadow-sm'
                : 'bg-elevated text-muted opacity-50 cursor-not-allowed',
            )}
          >
            {isRunning ? <LoadingDots /> : <ArrowUp size={15} />}
          </button>
        </div>
      </div>

      {/* ── Delete session confirmation ── */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete chat session"
          message={`"${confirmDelete.name}" and all its messages will be permanently deleted.`}
          confirmLabel="Delete session"
          onConfirm={() => deleteSession(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

function ChatMessage({ role, content, isStreaming }: { role: string; content: string; isStreaming?: boolean }) {
  return (
    <div className={clsx('flex gap-3', role === 'user' && 'flex-row-reverse')}>
      <div className={clsx(
        'shrink-0 w-7 h-7 rounded-full border flex items-center justify-center',
        role === 'user' ? 'bg-accent-500/10 border-accent-500/30' : 'bg-elevated border-base',
      )}>
        {role === 'user'
          ? <User size={13} className="text-accent-400" />
          : <Bot size={13} className="text-muted" />
        }
      </div>
      <div className={clsx(
        'max-w-[85%] rounded-xl px-3.5 py-2.5',
        role === 'user'
          ? 'bg-accent-500/15 border border-accent-500/25 text-sm text-fg'
          : 'bg-card border border-base',
      )}>
        {isStreaming ? (
          <LoadingDots />
        ) : (
          <div
            className="prose-chat text-sm leading-relaxed text-fg"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>
    </div>
  )
}

function renderMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^#{3} (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2} (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^\| (.+) \|$/gm, (_, row) => {
      const cells = row.split(' | ').map((c: string) => `<td>${c}</td>`).join('')
      return `<tr>${cells}</tr>`
    })
    .replace(/(<tr>.*<\/tr>)\n(<tr>.*<\/tr>)/gs, (_, h, body) =>
      `<table><thead>${h}</thead><tbody>${body}</tbody></table>`)
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/^(?!<[hup]|<li|<table|<br)(.+)$/gm, '<p>$1</p>')
}
