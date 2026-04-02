import { create } from 'zustand'
import type { Analysis } from '../types/repolens'
import type { Capability } from '../types/repolens'
import type { ChatMessage, OpenFile, OsSnapshot, OsWindow, TerminalLine, WindowApp } from './types'

const SNAPSHOT_KEY = 'repolens-os-v1'

type OsState = {
  windows: OsWindow[]
  nextWindowId: number
  nextZIndex: number
  repoUrl: string
  activeCapability: Capability
  currentAnalysisId: string | null
  analysisByRepo: Record<string, Analysis>
  analysisById: Record<string, Analysis>
  terminalLines: TerminalLine[]
  commandHistory: string[]
  commandCursor: number
  chatMessages: ChatMessage[]
  openFiles: Record<string, OpenFile>
  explorerTree: string[]
  selectedFilePath: string | null
  busy: boolean
  bootstrap: () => void
  openApp: (app: WindowApp) => void
  closeWindow: (id: string) => void
  focusWindow: (id: string) => void
  moveWindow: (id: string, x: number, y: number) => void
  resizeWindow: (id: string, width: number, height: number) => void
  toggleMinimize: (id: string) => void
  toggleMaximize: (id: string) => void
  setBusy: (busy: boolean) => void
  setRepoUrl: (url: string) => void
  setActiveCapability: (capability: Capability) => void
  cacheAnalysis: (analysis: Analysis) => void
  pushLine: (text: string, kind?: TerminalLine['kind']) => string
  updateLine: (id: string, text: string) => void
  clearLines: () => void
  pushCommandHistory: (command: string) => void
  moveCommandCursor: (direction: 'up' | 'down') => string
  resetCommandCursor: () => void
  pushChatMessage: (message: ChatMessage) => void
  setExplorerTree: (tree: string[]) => void
  setSelectedFile: (path: string | null) => void
  cacheFile: (path: string, content: string) => void
}

const appTitle: Record<WindowApp, string> = {
  terminal: 'Terminal',
  analyzer: 'Repo Analyzer',
  explorer: 'File Explorer',
  chat: 'AI Chat',
  settings: 'Settings',
}

function persistSnapshot(state: Pick<OsState, 'repoUrl' | 'activeCapability' | 'analysisByRepo' | 'analysisById' | 'currentAnalysisId' | 'terminalLines' | 'commandHistory' | 'chatMessages' | 'openFiles'>) {
  const snapshot: OsSnapshot = {
    repoUrl: state.repoUrl,
    activeCapability: state.activeCapability,
    analysisByRepo: state.analysisByRepo,
    analysisById: state.analysisById,
    currentAnalysisId: state.currentAnalysisId,
    terminalLines: state.terminalLines.slice(-300),
    commandHistory: state.commandHistory.slice(0, 120),
    chatMessages: state.chatMessages.slice(-100),
    openFiles: state.openFiles,
  }
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
}

function defaultTerminalLines(): TerminalLine[] {
  return [
    { id: 'boot-1', text: 'RepoLens OS boot sequence initialized.', kind: 'success' },
    { id: 'boot-2', text: "Type 'help' to list available commands.", kind: 'log' },
  ]
}

function defaultWindow(): OsWindow {
  return {
    id: 'win-1',
    app: 'terminal',
    title: appTitle.terminal,
    x: 120,
    y: 90,
    width: 860,
    height: 480,
    zIndex: 2,
    minimized: false,
    maximized: false,
  }
}

export const useOsStore = create<OsState>((set, get) => ({
  windows: [defaultWindow()],
  nextWindowId: 2,
  nextZIndex: 3,
  repoUrl: 'https://github.com/expressjs/express',
  activeCapability: 'analyze',
  currentAnalysisId: null,
  analysisByRepo: {},
  analysisById: {},
  terminalLines: defaultTerminalLines(),
  commandHistory: [],
  commandCursor: -1,
  chatMessages: [],
  openFiles: {},
  explorerTree: [],
  selectedFilePath: null,
  busy: false,
  bootstrap: () => {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return

    try {
      const snapshot = JSON.parse(raw) as OsSnapshot
      set((state) => ({
        ...state,
        repoUrl: snapshot.repoUrl || state.repoUrl,
        activeCapability: snapshot.activeCapability ?? state.activeCapability,
        analysisByRepo: snapshot.analysisByRepo ?? {},
        analysisById: snapshot.analysisById ?? {},
        currentAnalysisId: snapshot.currentAnalysisId ?? null,
        terminalLines: snapshot.terminalLines?.length ? snapshot.terminalLines : state.terminalLines,
        commandHistory: snapshot.commandHistory ?? [],
        chatMessages: snapshot.chatMessages ?? [],
        openFiles: snapshot.openFiles ?? {},
      }))
    } catch {
      // Ignore invalid local snapshot.
    }
  },
  openApp: (app) => {
    const existing = get().windows.find((window) => window.app === app)
    if (existing) {
      const nextZ = get().nextZIndex
      set((state) => ({
        windows: state.windows.map((window) =>
          window.id === existing.id
            ? { ...window, minimized: false, zIndex: nextZ }
            : window,
        ),
        nextZIndex: nextZ + 1,
      }))
      return
    }

    const nextId = get().nextWindowId
    const nextZ = get().nextZIndex
    const newWindow: OsWindow = {
      id: `win-${nextId}`,
      app,
      title: appTitle[app],
      x: 140 + nextId * 8,
      y: 90 + nextId * 8,
      width: app === 'terminal' ? 860 : 760,
      height: app === 'terminal' ? 480 : 440,
      zIndex: nextZ,
      minimized: false,
      maximized: false,
    }

    set((state) => ({
      windows: [...state.windows, newWindow],
      nextWindowId: nextId + 1,
      nextZIndex: nextZ + 1,
    }))
  },
  closeWindow: (id) => {
    set((state) => ({ windows: state.windows.filter((window) => window.id !== id) }))
  },
  focusWindow: (id) => {
    const nextZ = get().nextZIndex
    set((state) => ({
      windows: state.windows.map((window) =>
        window.id === id ? { ...window, zIndex: nextZ, minimized: false } : window,
      ),
      nextZIndex: nextZ + 1,
    }))
  },
  moveWindow: (id, x, y) => {
    set((state) => ({
      windows: state.windows.map((window) =>
        window.id === id && !window.maximized
          ? { ...window, x: Math.max(0, x), y: Math.max(40, y) }
          : window,
      ),
    }))
  },
  resizeWindow: (id, width, height) => {
    set((state) => ({
      windows: state.windows.map((window) =>
        window.id === id && !window.maximized
          ? { ...window, width: Math.max(360, width), height: Math.max(220, height) }
          : window,
      ),
    }))
  },
  toggleMinimize: (id) => {
    set((state) => ({
      windows: state.windows.map((window) =>
        window.id === id ? { ...window, minimized: !window.minimized } : window,
      ),
    }))
  },
  toggleMaximize: (id) => {
    set((state) => ({
      windows: state.windows.map((window) => {
        if (window.id !== id) return window

        if (window.maximized) {
          if (!window.restoreRect) return { ...window, maximized: false }
          return {
            ...window,
            maximized: false,
            x: window.restoreRect.x,
            y: window.restoreRect.y,
            width: window.restoreRect.width,
            height: window.restoreRect.height,
            restoreRect: undefined,
          }
        }

        return {
          ...window,
          maximized: true,
          restoreRect: { x: window.x, y: window.y, width: window.width, height: window.height },
          x: 12,
          y: 48,
          width: globalThis.window.innerWidth - 24,
          height: globalThis.window.innerHeight - 120,
        }
      }),
    }))
  },
  setBusy: (busy) => set({ busy }),
  setRepoUrl: (repoUrl) => {
    set({ repoUrl })
    persistSnapshot(get())
  },
  setActiveCapability: (activeCapability) => {
    set({ activeCapability })
    persistSnapshot(get())
  },
  cacheAnalysis: (analysis) => {
    set((state) => ({
      analysisByRepo: { ...state.analysisByRepo, [analysis.repoUrl]: analysis },
      analysisById: { ...state.analysisById, [analysis.id]: analysis },
      currentAnalysisId: analysis.id,
      repoUrl: analysis.repoUrl,
    }))
    persistSnapshot(get())
  },
  pushLine: (text, kind = 'log') => {
    const id = `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    set((state) => ({ terminalLines: [...state.terminalLines, { id, text, kind }] }))
    persistSnapshot(get())
    return id
  },
  updateLine: (id, text) => {
    set((state) => ({
      terminalLines: state.terminalLines.map((line) => (line.id === id ? { ...line, text } : line)),
    }))
    persistSnapshot(get())
  },
  clearLines: () => {
    set({ terminalLines: [] })
    persistSnapshot(get())
  },
  pushCommandHistory: (command) => {
    if (!command.trim()) return

    set((state) => ({
      commandHistory: [command, ...state.commandHistory.filter((item) => item !== command)].slice(0, 120),
      commandCursor: -1,
    }))
    persistSnapshot(get())
  },
  moveCommandCursor: (direction) => {
    const { commandHistory, commandCursor } = get()
    if (commandHistory.length === 0) return ''

    if (direction === 'up') {
      const next = Math.min(commandCursor + 1, commandHistory.length - 1)
      set({ commandCursor: next })
      return commandHistory[next]
    }

    const next = commandCursor - 1
    if (next < 0) {
      set({ commandCursor: -1 })
      return ''
    }

    set({ commandCursor: next })
    return commandHistory[next]
  },
  resetCommandCursor: () => set({ commandCursor: -1 }),
  pushChatMessage: (message) => {
    set((state) => ({ chatMessages: [...state.chatMessages, message].slice(-100) }))
    persistSnapshot(get())
  },
  setExplorerTree: (tree) => set({ explorerTree: tree }),
  setSelectedFile: (selectedFilePath) => set({ selectedFilePath }),
  cacheFile: (path, content) => {
    set((state) => ({ openFiles: { ...state.openFiles, [path]: { path, content } } }))
    persistSnapshot(get())
  },
}))
