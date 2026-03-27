import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useTerminalFeed } from './hooks/useTerminalFeed'
import { api } from './services/api'
import type { Analysis, Capability, ChatResponse, CompareResult, TestResult } from './types/repolens'

const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })))
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((module) => ({ default: module.WorkspacePage })))

type Screen = 'landing' | 'workspace'

function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [capability, setCapability] = useState<Capability>('explain')

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

  const docsBlob = useMemo(() => {
    if (!analysis) return '# Analyze a repository first'
    return `${analysis.docs.readme}\n\n${analysis.docs.apiOverview}\n\n${analysis.docs.onboarding}`
  }, [analysis])

  const ensureAnalysis = async () => {
    if (analysis && analysis.repoUrl === repoUrl) {
      return analysis
    }

    await terminal.pushFlow(['cloning repository...', 'analyzing stack and entry points...', 'building architecture maps...'])
    const fresh = await api.analyze(repoUrl)
    setAnalysis(fresh)
    setHistory((prev) => [repoUrl, ...prev.filter((item) => item !== repoUrl)])
    terminal.push('analysis completed successfully')
    return fresh
  }

  const runAction = async () => {
    setLoading(true)
    setError('')

    try {
      if (capability === 'compare') {
        await terminal.pushFlow(['running side-by-side compare...', 'calculating quality heuristics...'])
        const result = await api.compare(repoUrl, repoUrlSecond)
        setCompareResult(result)
        terminal.push('compare results ready')
        return
      }

      if (capability === 'run') {
        await terminal.pushFlow(['preparing sandbox runtime...', 'installing dependencies...', 'starting target app...'])
        const runResult = await api.run(repoUrl)
        setAnalysis(runResult)
        terminal.push(`preview ready at ${runResult.runIt.previewUrl}`)
        return
      }

      const fresh = await ensureAnalysis()

      if (capability === 'chat') {
        await terminal.pushFlow(['querying repository context...', 'generating ai response...'])
        const response = await api.chat(fresh.id, question)
        setChatResult(response)
        await terminal.streamText(response.answer, '> answer: ')
        return
      }

      if (capability === 'stats') {
        terminal.push('rendering repo score and activity metrics...')
      }

      if (capability === 'issues') {
        terminal.push('running security and smell inspection output...')
      }

      if (capability === 'structure') {
        terminal.push('drawing folder tree and graph topology...')
      }

      if (capability === 'docs') {
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

  const handleAnalyze = async () => {
    setCapability('explain')
    await runAction()
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
    <div className="mx-auto min-h-screen max-w-[1500px] px-4 py-6 md:px-6">
      <Suspense fallback={<div className="rounded-xl border border-slate-800 bg-slate-950/70 p-6 text-slate-300">Loading RepoLens...</div>}>
        {screen === 'landing' ? (
          <LandingPage
            repoUrl={repoUrl}
            onRepoUrlChange={setRepoUrl}
            onAnalyze={handleAnalyze}
            loading={loading}
          />
        ) : (
          <WorkspacePage
            capability={capability}
            onCapabilityChange={setCapability}
            repoUrl={repoUrl}
            repoUrlSecond={repoUrlSecond}
            question={question}
            onRepoUrlChange={setRepoUrl}
            onRepoUrlSecondChange={setRepoUrlSecond}
            onQuestionChange={setQuestion}
            onRunAction={runAction}
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
          />
        )}
      </Suspense>
    </div>
  )
}

export default App
