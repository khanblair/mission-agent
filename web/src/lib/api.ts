import type { EngineStatus, Mission, Run, RunResult } from '../types'

const BASE = '/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

// Missions
export const api = {
  missions: {
    list: () => req<Mission[]>('/missions'),
    get: (id: string) => req<Mission>(`/missions/${id}`),
    create: (name: string) => req<Mission>('/missions', { method: 'POST', body: JSON.stringify({ name }) }),
    update: (id: string, patch: Partial<Pick<Mission, 'name' | 'script' | 'summary'>>) =>
      req<Mission>(`/missions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    delete: (id: string) => req<void>(`/missions/${id}`, { method: 'DELETE' }),
    runs: (id: string) => req<Run[]>(`/missions/${id}/runs`),
  },

  engine: {
    status: () => req<EngineStatus>('/engine/status'),
    run: (script: string, mission_id?: string) =>
      req<RunResult>('/engine/run', {
        method: 'POST',
        body: JSON.stringify({ script, mission_id }),
      }),
    getRun: (run_id: string) => req<Run>(`/engine/runs/${run_id}`),
    templates: () => req<unknown[]>('/engine/templates'),
    getTemplate: (id: string) => req<{ id: string; meta: unknown; script: string }>(`/engine/templates/${id}`),
    parseResources: (script: string) =>
      req<unknown>('/engine/parse-resources', { method: 'POST', body: JSON.stringify({ script }) }),
  },
}
