import { useRef, useState } from 'react'
import type { TerminalLine } from '../os/types'

type TerminalAppProps = {
  lines: TerminalLine[]
  busy: boolean
  onExecute: (command: string) => Promise<void>
  onHistory: (direction: 'up' | 'down') => string
  onResetHistoryCursor: () => void
}

const autoCompleteCommands = ['help', 'clear', 'analyze', 'run', 'issues', 'stats', 'structure', 'chat', 'compare', 'open explorer', 'open analyzer']

export function TerminalApp({ lines, busy, onExecute, onHistory, onResetHistoryCursor }: TerminalAppProps) {
  const [command, setCommand] = useState('')
  const bodyRef = useRef<HTMLDivElement | null>(null)

  const runCommand = async () => {
    const trimmed = command.trim()
    if (!trimmed || busy) return
    setCommand('')
    onResetHistoryCursor()
    await onExecute(trimmed)
    requestAnimationFrame(() => {
      bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  return (
    <div className="terminal-root">
      <div className="terminal-scroll" ref={bodyRef}>
        {lines.map((line) => (
          <p key={line.id} className={`terminal-line terminal-${line.kind}`}>
            {line.text}
          </p>
        ))}
      </div>

      <div className="terminal-input-row">
        <span className="terminal-prompt">repolens@os:~$</span>
        <input
          className="terminal-input"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void runCommand()
              return
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setCommand(onHistory('up'))
              return
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setCommand(onHistory('down'))
              return
            }

            if (event.key === 'Tab') {
              event.preventDefault()
              const lower = command.toLowerCase()
              const match = autoCompleteCommands.find((item) => item.startsWith(lower))
              if (match) {
                setCommand(match)
              }
            }
          }}
          placeholder="type command..."
        />
        <span className="terminal-cursor" aria-hidden>
          ▋
        </span>
      </div>
    </div>
  )
}
