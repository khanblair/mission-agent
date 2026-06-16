import { useCallback, useEffect, useRef, useState } from 'react'
import type { WsEvent } from '../types'

type WsStatus = 'connecting' | 'open' | 'closed' | 'error'

interface UseAgentWsOptions {
  missionId: string
  sessionId: string | null
  onChunk: (chunk: string) => void
  onDone: (runData: WsEvent & { type: 'done' }) => void
  onError: (msg: string) => void
  onOpen?: () => void
}

const RECONNECT_DELAY_MS = 3000

export function useAgentWs({ missionId, sessionId, onChunk, onDone, onError, onOpen }: UseAgentWsOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [status, setStatus] = useState<WsStatus>('closed')

  const clearReconnect = () => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current)
      reconnectRef.current = null
    }
  }

  const connect = useCallback(() => {
    // Never connect without a session — prevents spurious session creation on mission switch
    if (!sessionId) return

    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.hostname
    const port = import.meta.env.DEV ? '8000' : window.location.port
    const url = `${proto}://${host}:${port}/ws/chat/${missionId}?session_id=${encodeURIComponent(sessionId)}`

    const ws = new WebSocket(url)
    wsRef.current = ws
    setStatus('connecting')

    ws.onopen = () => {
      setStatus('open')
      onOpen?.()
    }

    ws.onclose = () => {
      if (wsRef.current !== ws) return
      setStatus('closed')
      reconnectRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
    }

    ws.onerror = () => {
      setStatus('error')
      onError('Disconnected — reconnecting…')
    }

    ws.onmessage = (e) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const evt = JSON.parse(e.data) as any
        if (evt.type === 'chunk') onChunk(evt.content)
        else if (evt.type === 'done') onDone(evt as WsEvent & { type: 'done' })
        else if (evt.type === 'error') onError(evt.content)
      } catch {
        // ignore malformed frames
      }
    }
  }, [missionId, sessionId, onChunk, onDone, onError, onOpen])

  const disconnect = useCallback(() => {
    clearReconnect()
    const ws = wsRef.current
    wsRef.current = null
    ws?.close()
  }, [])

  const send = useCallback((content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ content }))
    } else {
      onError('Not connected to server')
    }
  }, [onError])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return { status, send, connect, disconnect }
}
