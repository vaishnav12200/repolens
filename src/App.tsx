import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useTerminalFeed } from './hooks/useTerminalFeed'
import { api } from './services/api'
import type { Analysis, Capability, ChatResponse, CompareResult, TestResult } from './types/repolens'

const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })))
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((module) => ({ default: module.WorkspacePage })))

type Screen = 'landing' | 'workspace'

function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [capability, setCapability] = useState<Capability>('analyze')

  const [repoUrl, setRepoUrl] = useState('https://github.com/expressjs/express')
  const [repoUrlSecond, setRepoUrlSecond] = useState('https://github.com/fastify/fastify')
  const [question, setQuestion] = useState('Where is authentication handled?')

  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)
  const [chatResult, setChatResult] = useState<ChatResponse | null>(null)
  const [testResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const terminal = useTerminalFeed()

  useEffect(() => {
    const raw = localStorage.getItem('repolens-history')
    if (!raw) return

    try {
      setHistory(JSON.parse(raw) as string[])
    } catch {
      setHistory([])
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('repolens-history', JSON.stringify(history.slice(0, 12)))
  }, [history])

  useEffect(() => {
    const raw = localStorage.getItem('repolens-command-history')
    if (!raw) return

    try {
      setCommandHistory(JSON.parse(raw) as string[])
    } catch {
      setCommandHistory([])
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('repolens-command-history', JSON.stringify(commandHistory.slice(0, 80)))
  }, [commandHistory])

  const docsBlob = useMemo(() => {
    if (!analysis) return '# Analyze a repository first'
    return `${analysis.docs.readme}\n\n${analysis.docs.apiOverview}\n\n${analysis.docs.onboarding}`
  }, [analysis])

  const ensureAnalysis = async (targetRepo = repoUrl) => {
    if (analysis && analysis.repoUrl === targetRepo) {
      return analysis
    }

    await terminal.pushFlow(['cloning repository...', 'analyzing stack and entry points...', 'building architecture maps...'])
    const fresh = await api.analyze(targetRepo)
    setAnalysis(fresh)
    setRepoUrl(targetRepo)
    setHistory((prev) => [targetRepo, ...prev.filter((item) => item !== targetRepo)])
    terminal.push('analysis completed successfully')
    return fresh
  }

  const runAction = async (nextCapability: Capability, payload?: { repo?: string; repoSecond?: string; question?: string }) => {
    setLoading(true)
    setError('')
    setCapability(nextCapability)

    try {
      if (nextCapability === 'compare') {
        const left = payload?.repo ?? repoUrl
        const right = payload?.repoSecond ?? repoUrlSecond
        setRepoUrl(left)
        setRepoUrlSecond(right)
        await terminal.pushFlow(['running side-by-side compare...', 'calculating quality heuristics...'])
        const result = await api.compare(left, right)
        setCompareResult(result)
        terminal.push('compare results ready')
        return
      }

      if (nextCapability === 'run') {
        const targetRepo = payload?.repo ?? repoUrl
        setRepoUrl(targetRepo)
        await terminal.pushFlow(['preparing sandbox runtime...', 'installing dependencies...', 'starting target app...'])
        const runResult = await api.run(targetRepo)
        setAnalysis(runResult)
        setHistory((prev) => [targetRepo, ...prev.filter((item) => item !== targetRepo)])
        terminal.push(`preview ready at ${runResult.runIt.previewUrl}`)
        return
      }

      const targetRepo = payload?.repo ?? repoUrl
      const fresh = await ensureAnalysis(targetRepo)

      if (nextCapability === 'chat') {
        const finalQuestion = payload?.question ?? question
        setQuestion(finalQuestion)
        await terminal.pushFlow(['querying repository context...', 'generating ai response...'])
        const response = await api.chat(fresh.id, finalQuestion)
        setChatResult(response)
        await terminal.streamText(response.answer, '> answer: ')
        return
      }

      if (nextCapability === 'stats') {
        terminal.push('rendering repo score and activity metrics...')
      }

      if (nextCapability === 'issues') {
        terminal.push('running security and smell inspection output...')
      }

      if (nextCapability === 'structure') {
        terminal.push('drawing folder tree and graph topology...')
      }

      if (nextCapability === 'docs') {
        terminal.push('docs bundle ready for download')
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unknown error'
      setError(message)
      terminal.push(`error: ${message}`)
    } finally {
      setLoading(false)
      setScreen('workspace')
    }
  }

  const parseCommand = (raw: string): { command: string; args: string[] } => {
    const parts = raw.match(/(?:"([^"]+)")|(?:'([^']+)')|(\S+)/g) ?? []
    const normalized = parts.map((part) => part.replace(/^['"]|['"]$/g, ''))
    const [command = '', ...args] = normalized
    return { command: command.toLowerCase(), args }
  }

  const executeCommand = async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return

    setCommandHistory((prev) => [trimmed, ...prev.filter((line) => line !== trimmed)])
    await terminal.pushCommand(trimmed)

    const { command, args } = parseCommand(trimmed)

    if (command === 'analyze') {
      const targetRepo = args[0] ?? repoUrl
      await runAction('analyze', { repo: targetRepo })
      return
    }

    if (command === 'run') {
      await runAction('run', { repo: repoUrl })
      return
    }

    if (command === 'issues') {
      await runAction('issues', { repo: repoUrl })
      return
    }

    if (command === 'stats') {
      await runAction('stats', { repo: repoUrl })
      return
    }

    if (command === 'structure') {
      await runAction('structure', { repo: repoUrl })
      return
    }

    if (command === 'docs') {
      await runAction('docs', { repo: repoUrl })
      return
    }

    if (command === 'chat') {
      const prompt = args.join(' ').trim()
      if (!prompt) {
        terminal.push('error: usage -> chat <question>')
        return
      }

      await runAction('chat', { repo: repoUrl, question: prompt })
      return
    }

    if (command === 'compare') {
      if (args.length < 2) {
        terminal.push('error: usage -> compare <repo1> <repo2>')
        return
      }

      await runAction('compare', { repo: args[0], repoSecond: args[1] })
      return
    }

    if (command === 'help') {
      terminal.push('available commands: analyze <url>, structure, issues, stats, run, chat <question>, docs, compare <repo1> <repo2>')
      return
    }

    terminal.push(`error: unknown command '${command}'. type 'help'.`)
  }

  const handleAnalyze = async (url: string) => {
    setRepoUrl(url)
    await executeCommand(`analyze ${url}`)
  }

  const downloadDocs = () => {
    const blob = new Blob([docsBlob], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'repolens-generated-docs.md'
    link.click()
    URL.revokeObjectURL(url)
    terminal.push('downloaded generated docs file')
  }

  return (
    <div className="min-h-screen">
      <Suspense fallback={<div className="rounded-xl border border-slate-800 bg-slate-950/70 p-6 text-slate-300">Loading RepoLens...</div>}>
        {screen === 'landing' ? (
          <LandingPage
            repoUrl={repoUrl}
            onAnalyze={handleAnalyze}
            loading={loading}
            terminalLines={terminal.lines}
          />
        ) : (
          <WorkspacePage
            capability={capability}
            repoUrl={repoUrl}
            onExecuteCommand={executeCommand}
            onBack={() => setScreen('landing')}
            onDownloadDocs={downloadDocs}
            loading={loading}
            error={error}
            analysis={analysis}
            compareResult={compareResult}
            testResult={testResult}
            chatResult={chatResult}
            terminalLines={terminal.lines}
            history={history}
            commandHistory={commandHistory}
          />
        )}
      </Suspense>
    </div>
  )
}

export default App
