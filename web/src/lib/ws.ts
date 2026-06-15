import { useCallback, useEffect, useRef, useState } from 'react'
import type { WsEvent } from '../types'

type WsStatus = 'connecting' | 'open' | 'closed' | 'error'

interface UseAgentWsOptions {
  missionId: string
  onChunk: (chunk: string) => void
  onDone: (runData: WsEvent & { type: 'done' }) => void
  onError: (msg: string) => void
}

export function useAgentWs({ missionId, onChunk, onDone, onError }: UseAgentWsOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<WsStatus>('closed')

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.hostname
    const port = import.meta.env.DEV ? '8000' : window.location.port
    const url = `${proto}://${host}:${port}/ws/chat/${missionId}`

    const ws = new WebSocket(url)
    wsRef.current = ws
    setStatus('connecting')

    ws.onopen = () => setStatus('open')
    ws.onclose = () => setStatus('closed')
    ws.onerror = () => {
      setStatus('error')
      onError('WebSocket connection failed')
    }
    ws.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as WsEvent
        if (evt.type === 'chunk') onChunk(evt.content)
        else if (evt.type === 'done') onDone(evt)
        else if (evt.type === 'error') onError(evt.content)
      } catch {
        // ignore malformed frames
      }
    }
  }, [missionId, onChunk, onDone, onError])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
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
