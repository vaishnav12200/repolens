import { useState } from 'react'

type FeedLine = {
  id: string
  text: string
}

export function useTerminalFeed() {
  const [lines, setLines] = useState<FeedLine[]>([
    { id: crypto.randomUUID(), text: '> RepoLens shell online. Type help to list commands.' },
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

  const pushCommand = async (command: string, delay = 14) => {
    const id = crypto.randomUUID()
    setLines((prev) => [...prev.slice(-80), { id, text: '$ ' }])

    let working = ''
    for (const char of command) {
      working += char
      setLines((prev) => prev.map((line) => (line.id === id ? { ...line, text: `$ ${working}` } : line)).slice(-80))
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return { lines, push, pushFlow, streamText, pushCommand }
}
