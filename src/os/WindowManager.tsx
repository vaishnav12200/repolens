import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { AnalyzerApp } from '../apps/AnalyzerApp'
import { ChatApp } from '../apps/ChatApp'
import { ExplorerApp } from '../apps/ExplorerApp'
import { SettingsApp } from '../apps/SettingsApp'
import { TerminalApp } from '../apps/TerminalApp'
import { useOsStore } from './useOsStore'
import type { OsWindow } from './types'

type WindowManagerProps = {
  onExecuteCommand: (command: string) => Promise<void>
  onAskChat: (question: string) => Promise<void>
  onOpenFile: (path: string) => Promise<void>
}

export function WindowManager({ onExecuteCommand, onAskChat, onOpenFile }: WindowManagerProps) {
  const windows = useOsStore((state) => state.windows)
  const busy = useOsStore((state) => state.busy)
  const terminalLines = useOsStore((state) => state.terminalLines)
  const analysisById = useOsStore((state) => state.analysisById)
  const currentAnalysisId = useOsStore((state) => state.currentAnalysisId)
  const activeCapability = useOsStore((state) => state.activeCapability)
  const chatMessages = useOsStore((state) => state.chatMessages)
  const explorerTree = useOsStore((state) => state.explorerTree)
  const selectedFilePath = useOsStore((state) => state.selectedFilePath)
  const openFiles = useOsStore((state) => state.openFiles)

  const closeWindow = useOsStore((state) => state.closeWindow)
  const focusWindow = useOsStore((state) => state.focusWindow)
  const moveWindow = useOsStore((state) => state.moveWindow)
  const resizeWindow = useOsStore((state) => state.resizeWindow)
  const toggleMinimize = useOsStore((state) => state.toggleMinimize)
  const toggleMaximize = useOsStore((state) => state.toggleMaximize)
  const moveCommandCursor = useOsStore((state) => state.moveCommandCursor)
  const resetCommandCursor = useOsStore((state) => state.resetCommandCursor)

  const selectedAnalysis = useMemo(() => {
    if (!currentAnalysisId) return null
    return analysisById[currentAnalysisId] ?? null
  }, [analysisById, currentAnalysisId])

  return (
    <div className="window-layer">
      {[...windows]
        .filter((window) => !window.minimized)
        .sort((left, right) => left.zIndex - right.zIndex)
        .map((window) => (
          <OsWindowFrame
            key={window.id}
            window={window}
            onFocus={focusWindow}
            onClose={closeWindow}
            onMove={moveWindow}
            onResize={resizeWindow}
            onMinimize={toggleMinimize}
            onMaximize={toggleMaximize}
          >
            {window.app === 'terminal' ? (
              <TerminalApp
                lines={terminalLines}
                busy={busy}
                onExecute={onExecuteCommand}
                onHistory={moveCommandCursor}
                onResetHistoryCursor={resetCommandCursor}
              />
            ) : null}

            {window.app === 'analyzer' ? <AnalyzerApp analysis={selectedAnalysis} capability={activeCapability} /> : null}

            {window.app === 'chat' ? <ChatApp messages={chatMessages} busy={busy} onAsk={onAskChat} /> : null}

            {window.app === 'explorer' ? (
              <ExplorerApp
                tree={explorerTree}
                selectedPath={selectedFilePath}
                selectedContent={selectedFilePath ? openFiles[selectedFilePath]?.content ?? null : null}
                onOpenFile={onOpenFile}
              />
            ) : null}

            {window.app === 'settings' ? <SettingsApp /> : null}
          </OsWindowFrame>
        ))}
    </div>
  )
}

type OsWindowFrameProps = {
  window: OsWindow
  children: ReactNode
  onFocus: (id: string) => void
  onClose: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
  onResize: (id: string, width: number, height: number) => void
  onMinimize: (id: string) => void
  onMaximize: (id: string) => void
}

const SNAP_THRESHOLD = 28
const SNAP_TOP = 48
const SNAP_BOTTOM_GAP = 120
const SNAP_SIDE_GAP = 12

function applySnap(window: OsWindow, pointerX: number, pointerY: number, onMove: (id: string, x: number, y: number) => void, onResize: (id: string, width: number, height: number) => void, onMaximize: (id: string) => void) {
  const viewportWidth = globalThis.window.innerWidth
  const viewportHeight = globalThis.window.innerHeight

  if (pointerY <= SNAP_THRESHOLD) {
    onMaximize(window.id)
    return
  }

  const snappedHeight = viewportHeight - SNAP_BOTTOM_GAP
  const snappedWidth = Math.max(360, Math.floor((viewportWidth - SNAP_SIDE_GAP * 3) / 2))

  if (pointerX <= SNAP_THRESHOLD) {
    onMove(window.id, SNAP_SIDE_GAP, SNAP_TOP)
    onResize(window.id, snappedWidth, snappedHeight)
    return
  }

  if (pointerX >= viewportWidth - SNAP_THRESHOLD) {
    onMove(window.id, viewportWidth - snappedWidth - SNAP_SIDE_GAP, SNAP_TOP)
    onResize(window.id, snappedWidth, snappedHeight)
  }
}

function OsWindowFrame({ window, children, onFocus, onClose, onMove, onResize, onMinimize, onMaximize }: OsWindowFrameProps) {
  const dragRef = useRef<{
    originX: number
    originY: number
    currentX: number
    currentY: number
    startX: number
    startY: number
  } | null>(null)
  const resizeRef = useRef<{ pointerX: number; pointerY: number; startW: number; startH: number } | null>(null)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="os-window"
      style={{
        left: window.x,
        top: window.y,
        width: window.width,
        height: window.height,
        zIndex: window.zIndex,
      }}
      onMouseDown={() => onFocus(window.id)}
    >
      <header
        className="window-titlebar"
        onMouseDown={(event) => {
          if (window.maximized) return
          onFocus(window.id)
          dragRef.current = {
            originX: event.clientX,
            originY: event.clientY,
            currentX: event.clientX,
            currentY: event.clientY,
            startX: window.x,
            startY: window.y,
          }

          const onMovePointer = (pointerEvent: MouseEvent) => {
            const state = dragRef.current
            if (!state) return
            state.currentX = pointerEvent.clientX
            state.currentY = pointerEvent.clientY
            onMove(window.id, state.startX + (pointerEvent.clientX - state.originX), state.startY + (pointerEvent.clientY - state.originY))
          }

          const onStop = () => {
            const activeDrag = dragRef.current
            dragRef.current = null
            globalThis.window.removeEventListener('mousemove', onMovePointer)
            globalThis.window.removeEventListener('mouseup', onStop)

            if (activeDrag) {
              const pointerX = activeDrag.currentX
              const pointerY = activeDrag.currentY
              applySnap(window, pointerX, pointerY, onMove, onResize, onMaximize)
            }
          }

          globalThis.window.addEventListener('mousemove', onMovePointer)
          globalThis.window.addEventListener('mouseup', onStop)
        }}
      >
        <div className="window-controls">
          <button className="win-btn close" onClick={() => onClose(window.id)} aria-label="Close window">
            *
          </button>
          <button className="win-btn min" onClick={() => onMinimize(window.id)} aria-label="Minimize window" />
          <button className="win-btn max" onClick={() => onMaximize(window.id)} aria-label="Maximize window" />
        </div>
        <p>{window.title}</p>
      </header>

      <main className="window-content">{children}</main>

      <button
        className="window-resize"
        onMouseDown={(event) => {
          if (window.maximized) return
          resizeRef.current = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            startW: window.width,
            startH: window.height,
          }

          const onMovePointer = (pointerEvent: MouseEvent) => {
            const state = resizeRef.current
            if (!state) return
            onResize(window.id, state.startW + (pointerEvent.clientX - state.pointerX), state.startH + (pointerEvent.clientY - state.pointerY))
          }

          const onStop = () => {
            resizeRef.current = null
            globalThis.window.removeEventListener('mousemove', onMovePointer)
            globalThis.window.removeEventListener('mouseup', onStop)
          }

          globalThis.window.addEventListener('mousemove', onMovePointer)
          globalThis.window.addEventListener('mouseup', onStop)
        }}
      />
    </motion.div>
  )
}
