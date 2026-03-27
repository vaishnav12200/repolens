import { useEffect, useState } from 'react'

const script = [
  '$ git clone --depth=1 https://github.com/org/repo',
  '$ repolens analyze --mode deep',
  '> detecting stack... Node.js, React, Express',
  '> mapping architecture and dependency graph...',
  '> scanning for security smells and TODO/FIXME...',
  '> generating docs and onboarding flow...',
  '✓ analysis complete',
]

export function TerminalPreview() {
  const [lineIndex, setLineIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [rendered, setRendered] = useState<string[]>([])

  useEffect(() => {
    if (lineIndex >= script.length) return

    const current = script[lineIndex]
    const doneTyping = charIndex >= current.length

    if (doneTyping) {
      const timeout = setTimeout(() => {
        setRendered((prev) => [...prev, current])
        setCharIndex(0)
        setLineIndex((prev) => prev + 1)
      }, 320)
      return () => clearTimeout(timeout)
    }

    const timeout = setTimeout(() => {
      setCharIndex((prev) => prev + 1)
    }, 24)

    return () => clearTimeout(timeout)
  }, [lineIndex, charIndex])

  const activeLine = lineIndex < script.length ? script[lineIndex].slice(0, charIndex) : ''

  return (
    <div className="rounded-xl border border-neon-600/50 bg-terminal-bg p-4 text-left shadow-neon">
      <div className="mb-3 flex items-center gap-2 text-xs text-neon-500/80">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <span className="h-2 w-2 rounded-full bg-yellow-400" />
        <span className="h-2 w-2 rounded-full bg-green-400" />
        <span className="ml-2 font-mono">repolens-terminal</span>
      </div>
      <div className="space-y-1 font-mono text-sm text-terminal-text">
        {rendered.map((line, index) => (
          <p key={`${line}-${index}`}>{line}</p>
        ))}
        {lineIndex < script.length && (
          <p>
            {activeLine}
            <span className="animate-pulse">▌</span>
          </p>
        )}
      </div>
    </div>
  )
}
