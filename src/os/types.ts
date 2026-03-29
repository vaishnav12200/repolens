import type { Analysis } from '../types/repolens'

export type WindowApp = 'terminal' | 'analyzer' | 'explorer' | 'chat' | 'settings'

export type OsWindow = {
  id: string
  app: WindowApp
  title: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  minimized: boolean
  maximized: boolean
  restoreRect?: Pick<OsWindow, 'x' | 'y' | 'width' | 'height'>
}

export type TerminalLine = {
  id: string
  text: string
  kind: 'command' | 'log' | 'error' | 'success'
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export type OpenFile = {
  path: string
  content: string
}

export type OsSnapshot = {
  repoUrl: string
  analysisByRepo: Record<string, Analysis>
  analysisById: Record<string, Analysis>
  currentAnalysisId: string | null
  terminalLines: TerminalLine[]
  commandHistory: string[]
  chatMessages: ChatMessage[]
  openFiles: Record<string, OpenFile>
}
