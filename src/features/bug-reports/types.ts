export type BugReportPage =
  | 'publico'
  | 'app-biker'
  | 'studio-fotografo'
  | 'admin'
  | 'otro'

export type BugReportKind = 'visual' | 'funcional' | 'rendimiento' | 'datos' | 'otro'

export type BugReportStatus = 'abierto' | 'en_progreso' | 'resuelto' | 'descartado'

export interface BugReport {
  id: string
  created_at: string
  reporter_id: string | null
  page: BugReportPage
  route: string
  kind: BugReportKind
  description: string
  screenshot_url: string | null
  status: BugReportStatus
}
