import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, Bot, Satellite, User, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import { useStore } from '../../store/useStore'
import { useAgentWs } from '../../lib/ws'
import { Badge } from '../../components/Badge'
import { LoadingDots } from '../../components/Spinner'
import type { RunResult, WsEvent } from '../../types'

const SUGGESTIONS = [
  'Design a 550 km sun-synchronous orbit',
  'Compute contact windows over New York for my LEO satellite',
  'Plan a Hohmann transfer from 400 km to 600 km',
  'How long will a 350 km orbit last before reentry?',
]

export function ChatPanel({ missionId }: { missionId: string }) {
  const { messages, addMessage, appendToLastAssistant, setLastRunResult, setCurrentScript, isRunning, setIsRunning } = useStore()
  const [input, setInput] = useState('')
  const [wsErr, setWsErr] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const onChunk = useCallback((chunk: string) => {
    appendToLastAssistant(chunk)
  }, [appendToLastAssistant])

  const onDone = useCallback((evt: WsEvent & { type: 'done' }) => {
    setIsRunning(false)
    if (evt.run_data) {
      setLastRunResult(evt.run_data)
      if (evt.run_data.czml) {
        // Persist script if run produced results
      }
    }
  }, [setIsRunning, setLastRunResult])

  const onError = useCallback((msg: string) => {
    setIsRunning(false)
    setWsErr(msg)
  }, [setIsRunning])

  const { status, send } = useAgentWs({ missionId, onChunk, onDone, onError })

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
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const wsColor = status === 'open' ? 'success' : status === 'error' ? 'danger' : 'warning'
  const wsLabel = status === 'open' ? 'Connected' : status === 'connecting' ? 'Connecting…' : 'Disconnected'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-base shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-accent-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">AI Agent</span>
        </div>
        <Badge variant={wsColor} dot>{wsLabel}</Badge>
      </div>

      {/* Messages */}
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
              <p className="text-sm font-medium text-base mb-1">Mission Agent ready</p>
              <p className="text-xs text-muted max-w-[220px] leading-relaxed">
                Describe your mission in plain language. I'll design the orbit, run the simulation, and explain the results.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-left px-3 py-2 rounded-lg border border-base bg-card hover:bg-elevated hover:border-accent-500/40 text-xs text-muted hover:text-base transition-all duration-150"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} isStreaming={isRunning && i === messages.length - 1 && msg.role === 'assistant' && msg.content === ''} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Error banner */}
      {wsErr && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
          {wsErr}
        </div>
      )}

      {/* Input */}
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
            className="flex-1 resize-none bg-transparent text-sm text-base placeholder:text-muted outline-none min-h-[32px] max-h-[120px] overflow-y-auto leading-relaxed py-1 px-1 disabled:opacity-50"
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
    </div>
  )
}

function ChatMessage({ role, content, isStreaming }: { role: string; content: string; isStreaming?: boolean }) {
  return (
    <div className={clsx('flex gap-3', role === 'user' && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={clsx(
        'shrink-0 w-7 h-7 rounded-full border flex items-center justify-center',
        role === 'user'
          ? 'bg-accent-500/10 border-accent-500/30'
          : 'bg-elevated border-base',
      )}>
        {role === 'user'
          ? <User size={13} className="text-accent-400" />
          : <Bot size={13} className="text-[hsl(var(--text-muted))]" />
        }
      </div>

      {/* Bubble */}
      <div className={clsx(
        'max-w-[85%] rounded-xl px-3.5 py-2.5',
        role === 'user'
          ? 'bg-accent-500/15 border border-accent-500/25 text-sm text-base'
          : 'bg-card border border-base',
      )}>
        {isStreaming ? (
          <LoadingDots />
        ) : (
          <div
            className="prose-chat text-sm leading-relaxed text-base"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>
    </div>
  )
}

/** Very lightweight markdown → HTML (no external dep) */
function renderMarkdown(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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
      `<table><thead>${h}</thead><tbody>${body}</tbody></table>`,
    )
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/^(?!<[hup]|<li|<table|<br)(.+)$/gm, '<p>$1</p>')
}
