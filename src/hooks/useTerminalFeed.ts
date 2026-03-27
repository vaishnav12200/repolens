import { useMemo, useState } from 'react'

type FeedLine = {
  id: string
  text: string
}

export function useTerminalFeed() {
  const [lines, setLines] = useState<FeedLine[]>([
    { id: crypto.randomUUID(), text: '> repo ready. paste a github url to begin.' },
  ])

  const push = (text: string) => {
    setLines((prev) => [...prev.slice(-80), { id: crypto.randomUUID(), text }])
  }

  const pushFlow = async (entries: string[], delay = 260) => {
    for (const entry of entries) {
      push(`> ${entry}`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  const streamText = async (text: string, prefix = '> ') => {
    let working = ''
    const id = crypto.randomUUID()
    setLines((prev) => [...prev.slice(-80), { id, text: prefix }])

    for (const char of text) {
      working += char
      setLines((prev) => prev.map((line) => (line.id === id ? { ...line, text: `${prefix}${working}` } : line)).slice(-80))
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  return useMemo(() => ({ lines, push, pushFlow, streamText }), [lines])
}
