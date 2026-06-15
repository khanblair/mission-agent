import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChatMessage, Mission, OutputTab, RunResult, Theme } from '../types'

interface AppState {
  // Theme
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void

  // Active mission
  activeMission: Mission | null
  setActiveMission: (m: Mission | null) => void

  // Chat
  messages: ChatMessage[]
  addMessage: (m: ChatMessage) => void
  appendToLastAssistant: (chunk: string) => void
  setMessages: (msgs: ChatMessage[]) => void
  clearMessages: () => void

  // Current script (single source of truth)
  currentScript: string
  setCurrentScript: (s: string) => void

  // Run state
  isRunning: boolean
  setIsRunning: (v: boolean) => void
  lastRunResult: RunResult | null
  setLastRunResult: (r: RunResult | null) => void

  // UI tabs
  outputTab: OutputTab
  setOutputTab: (t: OutputTab) => void
  scriptVisible: boolean
  toggleScript: () => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Theme
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme })
        const root = document.documentElement
        root.classList.remove('dark', 'light')
        root.classList.add(theme)
      },
      toggleTheme: () =>
        set((s) => {
          const next: Theme = s.theme === 'dark' ? 'light' : 'dark'
          document.documentElement.classList.remove('dark', 'light')
          document.documentElement.classList.add(next)
          return { theme: next }
        }),

      // Mission
      activeMission: null,
      setActiveMission: (m) => set({ activeMission: m }),

      // Chat
      messages: [],
      addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
      appendToLastAssistant: (chunk) =>
        set((s) => {
          const msgs = [...s.messages]
          const last = msgs[msgs.length - 1]
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, content: last.content + chunk }
          } else {
            msgs.push({ role: 'assistant', content: chunk })
          }
          return { messages: msgs }
        }),
      setMessages: (messages) => set({ messages }),
      clearMessages: () => set({ messages: [] }),

      // Script
      currentScript: '',
      setCurrentScript: (s) => set({ currentScript: s }),

      // Run
      isRunning: false,
      setIsRunning: (v) => set({ isRunning: v }),
      lastRunResult: null,
      setLastRunResult: (r) => set({ lastRunResult: r }),

      // UI
      outputTab: '3d',
      setOutputTab: (t) => set({ outputTab: t }),
      scriptVisible: false,
      toggleScript: () => set((s) => ({ scriptVisible: !s.scriptVisible })),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'mission-agent-store',
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
)
