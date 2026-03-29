import { useEffect, useMemo, useState } from 'react'
import { Dock } from './Dock'
import { WindowManager } from './WindowManager'
import { useOsStore } from './useOsStore'
import { api } from '../services/api'
import type { Analysis } from '../types/repolens'

const HELP_LINES = [
  'help',
  'clear',
  'analyze <repo_url>',
  'run',
  'issues',
  'stats',
  'structure',
  'chat <question>',
  'compare <repo1> <repo2>',
  'open explorer',
  'open analyzer',
]

function parseCommand(raw: string) {
  const parts = raw.match(/(?:"([^"]+)")|(?:'([^']+)')|(\S+)/g) ?? []
  const normalized = parts.map((part) => part.replace(/^['"]|['"]$/g, ''))
  const [command = '', ...args] = normalized
  return {
    command: command.toLowerCase(),
    args,
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function Desktop() {
  const [timeLabel, setTimeLabel] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))

  const windows = useOsStore((state) => state.windows)
  const repoUrl = useOsStore((state) => state.repoUrl)
  const analysisByRepo = useOsStore((state) => state.analysisByRepo)
  const currentAnalysisId = useOsStore((state) => state.currentAnalysisId)
  const analysisById = useOsStore((state) => state.analysisById)

  const openApp = useOsStore((state) => state.openApp)
  const setBusy = useOsStore((state) => state.setBusy)
  const setRepoUrl = useOsStore((state) => state.setRepoUrl)
  const cacheAnalysis = useOsStore((state) => state.cacheAnalysis)
  const pushLine = useOsStore((state) => state.pushLine)
  const updateLine = useOsStore((state) => state.updateLine)
  const clearLines = useOsStore((state) => state.clearLines)
  const pushCommandHistory = useOsStore((state) => state.pushCommandHistory)
  const pushChatMessage = useOsStore((state) => state.pushChatMessage)
  const setExplorerTree = useOsStore((state) => state.setExplorerTree)
  const setSelectedFile = useOsStore((state) => state.setSelectedFile)
  const cacheFile = useOsStore((state) => state.cacheFile)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLabel(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const focusedAnalysis = useMemo(() => {
    if (!currentAnalysisId) return null
    return analysisById[currentAnalysisId] ?? null
  }, [analysisById, currentAnalysisId])

  const ensureAnalysis = async (targetRepo: string) => {
    const existing = analysisByRepo[targetRepo]
    if (existing) return existing

    await streamStatus([
      'cloning repository...',
      'analyzing codebase...',
      'detecting stack and entry points...',
      'indexing structure graph...',
    ])

    const analysis = await api.analyze(targetRepo)
    cacheAnalysis(analysis)
    await streamTyped(`analysis ready: ${analysis.repoUrl}`)
    return analysis
  }

  const streamTyped = async (text: string, kind: 'log' | 'error' | 'success' = 'log') => {
    const lineId = pushLine('', kind)
    let typed = ''
    for (const char of text) {
      typed += char
      updateLine(lineId, typed)
      await wait(8)
    }
  }

  const streamStatus = async (lines: string[]) => {
    for (const line of lines) {
      await streamTyped(`> ${line}`)
    }
  }

  const executeCommand = async (raw: string) => {
    pushCommandHistory(raw)
    pushLine(`repolens@os:~$ ${raw}`, 'command')

    const { command, args } = parseCommand(raw)

    if (!command) return

    if (command === 'help') {
      for (const line of HELP_LINES) {
        pushLine(line)
      }
      return
    }

    if (command === 'clear') {
      clearLines()
      return
    }

    setBusy(true)
    try {
      if (command === 'analyze') {
        const targetRepo = args[0] ?? repoUrl
        setRepoUrl(targetRepo)
        await ensureAnalysis(targetRepo)
        openApp('analyzer')
        return
      }

      if (command === 'run') {
        const activeRepo = focusedAnalysis?.repoUrl ?? repoUrl
        await streamStatus(['preparing sandbox runner...', 'installing dependencies...', 'starting repository runtime...'])
        const runResult = await api.run(activeRepo)
        cacheAnalysis(runResult)
        await streamTyped(`preview url: ${runResult.runIt.previewUrl}`, 'success')
        return
      }

      if (command === 'issues') {
        const activeRepo = focusedAnalysis?.repoUrl ?? repoUrl
        const analysis = await ensureAnalysis(activeRepo)
        await streamTyped(`security issues: ${analysis.issues.security.length}`)
        await streamTyped(`code smells: ${analysis.issues.smells.length}`)
        await streamTyped(`hardcoded secrets: ${analysis.issues.hardcodedSecrets.length}`)
        openApp('analyzer')
        return
      }

      if (command === 'stats') {
        const activeRepo = focusedAnalysis?.repoUrl ?? repoUrl
        const analysis = await ensureAnalysis(activeRepo)
        await streamTyped(`repo score: ${analysis.stats.repoScore}`, 'success')
        await streamTyped(`velocity(90d): ${analysis.stats.commitVelocity90d}`)
        await streamTyped(`coverage estimate: ${analysis.stats.testCoverageEstimate}%`)
        openApp('analyzer')
        return
      }

      if (command === 'structure') {
        const activeRepo = focusedAnalysis?.repoUrl ?? repoUrl
        const analysis = await ensureAnalysis(activeRepo)
        await streamTyped(`architecture nodes: ${analysis.structure.architecture.length}`)
        await streamTyped(`dependency graph edges: ${analysis.structure.dependencyGraph.length}`)
        openApp('analyzer')
        return
      }

      if (command === 'chat') {
        const question = args.join(' ').trim()
        if (!question) {
          pushLine('error: usage -> chat <question>', 'error')
          return
        }

        const activeRepo = focusedAnalysis?.repoUrl ?? repoUrl
        const analysis = await ensureAnalysis(activeRepo)
        pushChatMessage({ id: `chat-u-${Date.now()}`, role: 'user', text: question })
        await streamStatus(['collecting repository context...', 'running ai assistant...'])
        const answer = await api.chat(analysis.id, question)
        pushChatMessage({ id: `chat-a-${Date.now()}`, role: 'assistant', text: answer.answer })
        await streamTyped(`ai: ${answer.answer}`, 'success')
        openApp('chat')
        return
      }

      if (command === 'compare') {
        if (args.length < 2) {
          pushLine('error: usage -> compare <repo1> <repo2>', 'error')
          return
        }

        await streamStatus(['analyzing left repository...', 'analyzing right repository...', 'building differential report...'])
        const compareResult = await api.compare(args[0], args[1])
        await streamTyped(`recommendation: ${compareResult.recommendation}`, 'success')
        return
      }

      if (command === 'open') {
        const target = args.join(' ').toLowerCase()
        if (target === 'explorer') {
          const activeRepo = focusedAnalysis?.repoUrl ?? repoUrl
          const tree = await api.explorerTree(activeRepo)
          setExplorerTree(tree.files)
          setSelectedFile(null)
          openApp('explorer')
          await streamTyped(`explorer loaded: ${tree.files.length} files`)
          return
        }

        if (target === 'analyzer') {
          openApp('analyzer')
          pushLine('analyzer window opened', 'success')
          return
        }

        pushLine("error: usage -> open explorer | open analyzer", 'error')
        return
      }

      pushLine(`error: unknown command '${command}'. type 'help'.`, 'error')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      pushLine(`error: ${message}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleAskChat = async (question: string) => {
    await executeCommand(`chat ${question}`)
  }

  const handleOpenFile = async (path: string) => {
    const analysis = focusedAnalysis
    if (!analysis) {
      pushLine('error: analyze repository before opening files.', 'error')
      return
    }

    const file = await api.explorerFile(analysis.id, path)
    setSelectedFile(file.path)
    cacheFile(file.path, file.content)
  }

  return (
    <div className="os-desktop">
      <div className="desktop-particles" />

      <header className="os-topbar">
        <p className="os-name">RepoLens OS</p>
        <div className="os-status">
          <span>CPU ◔</span>
          <span>NET ▲</span>
          <span>AI ●</span>
          <span>{timeLabel}</span>
        </div>
      </header>

      <WindowManager onExecuteCommand={executeCommand} onAskChat={handleAskChat} onOpenFile={handleOpenFile} />
      <Dock onOpen={openApp} />

      {windows.length === 0 ? (
        <button className="reopen-terminal" onClick={() => openApp('terminal')}>
          Open Terminal
        </button>
      ) : null}
    </div>
  )
}
