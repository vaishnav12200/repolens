import { useEffect, useMemo, useState } from 'react'
import { CommandInput } from '../components/CommandInput'
import { Terminal } from '../components/Terminal'

type Props = {
  repoUrl: string
  onAnalyze: (url: string) => void
  loading: boolean
  terminalLines: Array<{ id: string; text: string }>
}

const bootScript = [
  'Initializing RepoLens OS...',
  'Loading AI modules...',
  'Connecting to Git systems...',
  'Ready.',
]

export function LandingPage({ repoUrl, onAnalyze, loading, terminalLines }: Props) {
  const [bootLines, setBootLines] = useState<string[]>([])
  const [input, setInput] = useState(repoUrl)

  useEffect(() => {
    setInput(repoUrl)
  }, [repoUrl])

  useEffect(() => {
    if (bootLines.length >= bootScript.length) return

    const timeout = setTimeout(() => {
      setBootLines((prev) => [...prev, bootScript[prev.length]])
    }, bootLines.length === 0 ? 240 : 540)

    return () => clearTimeout(timeout)
  }, [bootLines])

  const lines = useMemo(() => {
    const base = bootLines.map((line) => ({ id: `${line}-${Math.random()}`, text: `> ${line}` }))
    if (bootLines.length >= bootScript.length) {
      base.push({ id: 'prompt', text: '> Enter repository URL:' })
      base.push({ id: 'hint', text: '> Press Enter to boot workspace.' })
    }
    return [...base, ...terminalLines.slice(-8)]
  }, [bootLines, terminalLines])

  return (
    <div className="landing-screen">
      <Terminal title="RepoLens Boot Console" lines={lines} className="landing-terminal" />
      <div className="landing-input">
        <CommandInput
          value={input}
          disabled={loading || bootLines.length < bootScript.length}
          onChange={setInput}
          placeholder="https://github.com/owner/repo"
          onSubmit={() => {
            if (!input.trim()) return
            onAnalyze(input.trim())
          }}
          autoFocus
        />
      </div>
    </div>
  )
}
