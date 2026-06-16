// ── Domain types ──────────────────────────────────────────────────────────────

export interface Mission {
  id: string
  name: string
  script: string | null
  summary: string | null
  created_at: string
  updated_at: string
  messages?: ChatMessage[]
}

export interface Run {
  id: string
  mission_id: string
  status: 'pending' | 'running' | 'completed' | 'error'
  script: string | null
  result: RunResult | null
  error: string | null
  created_at: string
  completed_at: string | null
}

export interface RunResult {
  run_id: string
  mock: boolean
  orbit_summary: OrbitSummary | null
  groundtrack_segments: GroundTrackPoint[][]
  czml: unknown[]
  elements_sample: OrbitalElements[]
  validation?: ValidationResult
  script?: string
}

export interface OrbitSummary {
  alt_mean_km: number
  alt_min_km: number
  alt_max_km: number
  ecc_mean: number
  inc_deg: number
  period_min: number
}

export interface OrbitalElements {
  t: string
  alt: number
  ecc: number
  inc: number
  raan: number
  aop: number
  ta: number
}

export interface GroundTrackPoint {
  lat: number
  lon: number
  alt: number
  t: string
}

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at?: string
}

export interface ChatSession {
  id: string
  mission_id: string
  name: string
  created_at: string
  updated_at: string
  messages?: ChatMessage[]
}

export interface ValidationResult {
  ok: boolean
  warnings: string[]
  errors: string[]
}

export interface EngineStatus {
  mode: 'real' | 'mock'
  gmat_path: string
}

// ── WebSocket event types ─────────────────────────────────────────────────────

export type WsEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; run_data: RunResult | null }
  | { type: 'error'; content: string }

// ── UI types ──────────────────────────────────────────────────────────────────

export type Theme = 'dark' | 'light'
export type OutputTab = '3d' | 'groundtrack' | 'report'
export type PanelTab = 'chat' | 'resources' | 'sequence'
