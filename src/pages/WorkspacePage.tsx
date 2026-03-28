import { useEffect, useMemo, useState } from 'react'
import { CommandInput } from '../components/CommandInput'
import { OutputPanel } from '../components/OutputPanel'
import { Terminal } from '../components/Terminal'
import type { Analysis, Capability, ChatResponse, CompareResult, TestResult } from '../types/repolens'

type Props = {
  capability: Capability
  repoUrl: string
  onExecuteCommand: (command: string) => Promise<void>
  onBack: () => void
  onDownloadDocs: () => void
  loading: boolean
  error: string
  analysis: Analysis | null
  compareResult: CompareResult | null
  testResult: TestResult | null
  chatResult: ChatResponse | null
  terminalLines: Array<{ id: string; text: string }>
  history: string[]
  commandHistory: string[]
}

const commandMenu = ['analyze', 'structure', 'issues', 'stats', 'run', 'chat', 'docs', 'compare']

export function WorkspacePage({
  capability,
  repoUrl,
  onExecuteCommand,
  onBack,
  onDownloadDocs,
  loading,
  error,
  analysis,
  compareResult,
  testResult,
  chatResult,
  terminalLines,
  history,
  commandHistory,
}: Props) {
  const [currentCommand, setCurrentCommand] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [activeMenu, setActiveMenu] = useState(0)

  const menuLines = useMemo(
    () => commandMenu.map((command, index) => ({ id: command, text: `${index === activeMenu ? '>' : ' '} ${command}` })),
    [activeMenu],
  )

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.tagName === 'INPUT') return

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setActiveMenu((prev) => (prev + 1) % commandMenu.length)
      }

      if (event.key.toLowerCase() === 'j') {
        event.preventDefault()
        setActiveMenu((prev) => (prev - 1 + commandMenu.length) % commandMenu.length)
      }

      if (event.key === 'Enter' && !loading) {
        event.preventDefault()
        void onExecuteCommand(commandMenu[activeMenu])
      }
    }

    window.addEventListener('keydown', onWindowKeyDown)
    return () => window.removeEventListener('keydown', onWindowKeyDown)
  }, [activeMenu, loading, onExecuteCommand])

  const runCurrentCommand = async () => {
    const command = currentCommand.trim()
    if (!command) return
    setHistoryIndex(-1)
    setCurrentCommand('')
    await onExecuteCommand(command)
  }

  const pickHistory = (direction: 'up' | 'down') => {
    if (!commandHistory.length) return

    if (direction === 'up') {
      const nextIndex = Math.min(commandHistory.length - 1, historyIndex + 1)
      setHistoryIndex(nextIndex)
      setCurrentCommand(commandHistory[nextIndex])
      return
    }

    const nextIndex = historyIndex - 1
    if (nextIndex < 0) {
      setHistoryIndex(-1)
      setCurrentCommand('')
      return
    }

    setHistoryIndex(nextIndex)
    setCurrentCommand(commandHistory[nextIndex])
  }

  return (
    <div className="workspace-screen">
      <aside className="workspace-left">
        <Terminal title="command menu" lines={menuLines} className="menu-terminal" />
        <p className="shortcut-hint">hotkeys: j/k navigate · enter run</p>
        <div className="left-meta">
          <p>repo: {repoUrl}</p>
          {history.slice(0, 3).map((url) => (
            <p key={url}>hist: {url}</p>
          ))}
        </div>
      </aside>

      <OutputPanel
        capability={capability}
        analysis={analysis}
        compareResult={compareResult}
        testResult={testResult}
        chatResult={chatResult}
        error={error}
      />

      <section className="workspace-bottom">
        <Terminal title="runtime console" lines={terminalLines} className="runtime-terminal" />
        <CommandInput
          value={currentCommand}
          disabled={loading}
          onChange={setCurrentCommand}
          onSubmit={() => void runCurrentCommand()}
          onHistoryUp={() => pickHistory('up')}
          onHistoryDown={() => pickHistory('down')}
          placeholder="analyze https://github.com/user/repo"
          autoFocus
        />
        <div className="workspace-actions">
          <button onClick={onBack} className="ghost-command">
            exit
          </button>
          <button onClick={onDownloadDocs} disabled={!analysis} className="ghost-command">
            download-docs
          </button>
        </div>
      </section>
    </div>
  )
}
