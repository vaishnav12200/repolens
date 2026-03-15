import { useMemo, useState } from 'react'
import './App.css'

type Analysis = {
  id: string
  repoUrl: string
  analyzedAt: string
  runIt: {
    detectedStack: string[]
    installCommand: string
    startCommand: string
    previewUrl: string
    notes: string[]
  }
  explainIt: {
    summary: string
    stackBreakdown: Array<{ name: string; confidence: string; evidence: string }>
    entryPoints: Array<{ path: string; line?: number }>
    businessLogic: string[]
  }
  structure: {
    folderTree: string[]
    architecture: string[]
    callGraph: Array<{ from: string; to: string }>
    dependencyGraph: Array<{ module: string; dependsOn: string[] }>
  }
  issues: {
    security: Array<{ title: string; file: string; severity: string }>
    outdated: Array<{ packageName: string; current: string; severity: string }>
    smells: Array<{ title: string; file: string }>
    missingErrorHandling: Array<{ path: string }>
    hardcodedSecrets: Array<{ path: string }>
  }
  stats: {
    mostChangedFiles: Array<{ file: string; commits: number }>
    busFactorByFolder: Array<{ folder: string; authors: number }>
    codeAgeHeatmap: Array<{ file: string; lastUpdated: string }>
    commitVelocity90d: number
    testCoverageEstimate: number
  }
  testing: {
    detectedTestCommands: string[]
    testFiles: number
    untestedCandidateFiles: string[]
  }
  docs: {
    readme: string
    apiOverview: string
    onboarding: string
  }
  learning: {
    tutorialSteps: string[]
    importantFiles: Array<{ path: string; line?: number }>
    glossary: Array<{ term: string; meaning: string }>
  }
}

type CompareResult = {
  left: {
    repoUrl: string
    stats: { testCoverageEstimate: number; commitVelocity90d: number }
    issues: { security: Array<{ file: string }> }
  }
  right: {
    repoUrl: string
    stats: { testCoverageEstimate: number; commitVelocity90d: number }
    issues: { security: Array<{ file: string }> }
  }
  recommendation: string
}

function App() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/expressjs/express')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)

  const [chatQuestion, setChatQuestion] = useState('Where is authentication handled?')
  const [chatAnswer, setChatAnswer] = useState<string>('')
  const [chatRefs, setChatRefs] = useState<Array<{ path: string; line?: number }>>([])

  const [testSummary, setTestSummary] = useState('')

  const [leftUrl, setLeftUrl] = useState('https://github.com/expressjs/express')
  const [rightUrl, setRightUrl] = useState('https://github.com/fastify/fastify')
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)

  const docsBlob = useMemo(() => {
    if (!analysis) return '# Analyze a repository first'
    return `${analysis.docs.readme}\n\n${analysis.docs.apiOverview}\n\n${analysis.docs.onboarding}`
  }, [analysis])

  async function analyzeRepository() {
    setLoading(true)
    setError('')
    setAnalysis(null)
    setChatAnswer('')
    setTestSummary('')
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Analysis failed')
      }
      setAnalysis(data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function askRepoQuestion() {
    if (!analysis) return
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisId: analysis.id, question: chatQuestion }),
    })
    const data = await response.json()
    setChatAnswer(data.answer ?? '')
    setChatRefs(data.references ?? [])
  }

  async function runTestInsight() {
    const response = await fetch('/api/test-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl }),
    })
    const data = await response.json()
    if (response.ok) {
      setTestSummary(
        `${data.summary} Commands: ${(data.detectedCommands ?? []).join(', ')}. Suggested missing tests: ${(data.suggestedMissingTests ?? []).slice(0, 5).join(', ')}`,
      )
      return
    }
    setTestSummary(data.error ?? 'Unable to inspect tests')
  }

  async function compareRepos() {
    setCompareLoading(true)
    setCompareResult(null)
    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leftUrl, rightUrl }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? 'Compare failed')
      }
      setCompareResult(data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    } finally {
      setCompareLoading(false)
    }
  }

  function downloadDocs() {
    const blob = new Blob([docsBlob], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'repolens-generated-docs.md'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="page">
      <header className="hero">
        <h1>🔥 RepoLens</h1>
        <p>Understand any repository without cloning locally.</p>
        <div className="toolbar">
          <input
            value={repoUrl}
            onChange={(event) => setRepoUrl(event.target.value)}
            placeholder="Paste GitHub repo URL"
          />
          <button onClick={analyzeRepository} disabled={loading}>
            {loading ? 'Analyzing...' : 'Run + Explain + Map'}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </header>

      {analysis && (
        <section className="grid">
          <article className="card">
            <h2>1) Run It</h2>
            <p>Detected: {analysis.runIt.detectedStack.join(', ') || 'Unknown stack'}</p>
            <p>Install: {analysis.runIt.installCommand}</p>
            <p>Start: {analysis.runIt.startCommand}</p>
            <p>Sandbox URL: {analysis.runIt.previewUrl}</p>
          </article>

          <article className="card">
            <h2>2) Explain It</h2>
            <p>{analysis.explainIt.summary}</p>
            <ul>
              {analysis.explainIt.entryPoints.slice(0, 5).map((entry) => (
                <li key={entry.path}>{entry.path}</li>
              ))}
            </ul>
          </article>

          <article className="card">
            <h2>3) Draw the Structure</h2>
            <p>Architecture</p>
            <ul>
              {analysis.structure.architecture.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p>Folder sample ({analysis.structure.folderTree.length} items)</p>
          </article>

          <article className="card">
            <h2>4) Chat With Repo</h2>
            <div className="stacked">
              <input
                value={chatQuestion}
                onChange={(event) => setChatQuestion(event.target.value)}
                placeholder="Ask about auth, payments, forms..."
              />
              <button onClick={askRepoQuestion}>Ask</button>
              {chatAnswer && <p>{chatAnswer}</p>}
              {chatRefs.length > 0 && (
                <ul>
                  {chatRefs.map((ref) => (
                    <li key={ref.path}>{ref.path}</li>
                  ))}
                </ul>
              )}
            </div>
          </article>

          <article className="card">
            <h2>5) Find Issues</h2>
            <p>Security findings: {analysis.issues.security.length}</p>
            <p>Hardcoded secret hits: {analysis.issues.hardcodedSecrets.length}</p>
            <p>Code smells: {analysis.issues.smells.length}</p>
          </article>

          <article className="card">
            <h2>6) Repo Stats Dashboard</h2>
            <p>Commit velocity (90d): {analysis.stats.commitVelocity90d}</p>
            <p>Coverage estimate: {analysis.stats.testCoverageEstimate}%</p>
            <ul>
              {analysis.stats.mostChangedFiles.slice(0, 5).map((file) => (
                <li key={file.file}>
                  {file.file} — {file.commits} commits
                </li>
              ))}
            </ul>
          </article>

          <article className="card">
            <h2>7) Test It</h2>
            <p>Detected test files: {analysis.testing.testFiles}</p>
            <button onClick={runTestInsight}>Run Test Insight</button>
            {testSummary && <p>{testSummary}</p>}
          </article>

          <article className="card">
            <h2>8) Compare Two Repos</h2>
            <div className="stacked">
              <input value={leftUrl} onChange={(event) => setLeftUrl(event.target.value)} />
              <input value={rightUrl} onChange={(event) => setRightUrl(event.target.value)} />
              <button onClick={compareRepos} disabled={compareLoading}>
                {compareLoading ? 'Comparing...' : 'Compare'}
              </button>
              {compareResult && <p>{compareResult.recommendation}</p>}
            </div>
          </article>

          <article className="card">
            <h2>9) Generate Documentation</h2>
            <button onClick={downloadDocs}>Export Markdown</button>
            <p>README, API overview, and onboarding guide are generated.</p>
          </article>

          <article className="card">
            <h2>10) Learning Mode</h2>
            <ol>
              {analysis.learning.tutorialSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p>
              Important files: {analysis.learning.importantFiles.slice(0, 5).map((file) => file.path).join(', ')}
            </p>
          </article>
        </section>
      )}

      {!analysis && !loading && (
        <section className="empty">
          <h2>Paste a repository URL to begin</h2>
          <p>RepoLens will run analysis and unlock all 10 capabilities in one dashboard.</p>
        </section>
      )}
    </main>
  )
}

export default App
