import { useMemo, useRef } from 'react'
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

            {window.app === 'analyzer' ? <AnalyzerApp analysis={selectedAnalysis} /> : null}

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
  children: React.ReactNode
  onFocus: (id: string) => void
  onClose: (id: string) => void
  onMove: (id: string, x: number, y: number) => void
  onResize: (id: string, width: number, height: number) => void
  onMinimize: (id: string) => void
  onMaximize: (id: string) => void
}

function OsWindowFrame({ window, children, onFocus, onClose, onMove, onResize, onMinimize, onMaximize }: OsWindowFrameProps) {
  const dragRef = useRef<{ pointerX: number; pointerY: number; startX: number; startY: number } | null>(null)
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
            pointerX: event.clientX,
            pointerY: event.clientY,
            startX: window.x,
            startY: window.y,
          }

          const onMovePointer = (pointerEvent: MouseEvent) => {
            const state = dragRef.current
            if (!state) return
            onMove(window.id, state.startX + (pointerEvent.clientX - state.pointerX), state.startY + (pointerEvent.clientY - state.pointerY))
          }

          const onStop = () => {
            dragRef.current = null
            window.removeEventListener('mousemove', onMovePointer)
            window.removeEventListener('mouseup', onStop)
          }

          window.addEventListener('mousemove', onMovePointer)
          window.addEventListener('mouseup', onStop)
        }}
      >
        <div className="window-controls">
          <button className="win-btn close" onClick={() => onClose(window.id)} />
          <button className="win-btn min" onClick={() => onMinimize(window.id)} />
          <button className="win-btn max" onClick={() => onMaximize(window.id)} />
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
            window.removeEventListener('mousemove', onMovePointer)
            window.removeEventListener('mouseup', onStop)
          }

          window.addEventListener('mousemove', onMovePointer)
          window.addEventListener('mouseup', onStop)
        }}
      />
    </motion.div>
  )
}
