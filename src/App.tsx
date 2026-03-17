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

type TestResult = {
  detectedCommands: string[]
  testFiles: number
  suggestedMissingTests: string[]
  summary: string
}

type Screen = 'landing' | 'selector' | 'workspace'

type Feature = {
  id:
    | 'run'
    | 'explain'
    | 'structure'
    | 'chat'
    | 'issues'
    | 'stats'
    | 'test'
    | 'compare'
    | 'docs'
    | 'learn'
  title: string
  tag: string
  description: string
}

const FEATURES: Feature[] = [
  { id: 'run', title: 'Run It', tag: '01', description: 'Generate live sandbox commands and runtime preview info.' },
  { id: 'explain', title: 'Explain It', tag: '02', description: 'Get plain-English summary, stack and entry point walkthrough.' },
  { id: 'structure', title: 'Draw the Structure', tag: '03', description: 'See folder map, architecture notes, call/dependency graph slices.' },
  { id: 'chat', title: 'Chat With The Repo', tag: '04', description: 'Ask targeted questions and get file-based references.' },
  { id: 'issues', title: 'Find Issues', tag: '05', description: 'Surface security smells, hardcoded secrets and risky patterns.' },
  { id: 'stats', title: 'Repo Stats Dashboard', tag: '06', description: 'Track commit velocity, hot files, coverage estimate and bus factor.' },
  { id: 'test', title: 'Test It', tag: '07', description: 'Inspect detected tests and untested candidate areas instantly.' },
  { id: 'compare', title: 'Compare Two Repos', tag: '08', description: 'Evaluate two repos side-by-side with quality/activity heuristics.' },
  { id: 'docs', title: 'Generate Documentation', tag: '09', description: 'Auto-build README, API overview and onboarding guide.' },
  { id: 'learn', title: 'Learning Mode', tag: '10', description: 'Get a junior-friendly guided tour and key-file learning path.' },
]

function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(FEATURES[0])
  const [landingSelectedFeature, setLandingSelectedFeature] = useState<Feature['id'] | null>(FEATURES[0].id)

  const [repoUrl, setRepoUrl] = useState('https://github.com/expressjs/express')
  const [repoUrlSecond, setRepoUrlSecond] = useState('https://github.com/fastify/fastify')
  const [question, setQuestion] = useState('Where is authentication handled?')

  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)
  const [chatAnswer, setChatAnswer] = useState('')
  const [chatRefs, setChatRefs] = useState<Array<{ path: string; line?: number }>>([])
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const docsBlob = useMemo(() => {
    if (!analysis) return '# Analyze a repository first'
    return `${analysis.docs.readme}\n\n${analysis.docs.apiOverview}\n\n${analysis.docs.onboarding}`
  }, [analysis])

  function openFeatureWorkspace(feature: Feature) {
    setSelectedFeature(feature)
    setScreen('workspace')
    setError('')
    setChatAnswer('')
    setChatRefs([])
    setCompareResult(null)
    setTestResult(null)
  }

  async function ensureAnalysis() {
    if (analysis && analysis.repoUrl === repoUrl) {
      return analysis
    }

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
    return data as Analysis
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

  async function runSelectedFeature() {
    if (!selectedFeature) return

    setLoading(true)
    setError('')

    try {
      if (selectedFeature.id === 'compare') {
        const response = await fetch('/api/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leftUrl: repoUrl, rightUrl: repoUrlSecond }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error ?? 'Compare failed')
        }
        setCompareResult(data)
        return
      }

      if (selectedFeature.id === 'test') {
        const response = await fetch('/api/test-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error ?? 'Test inspection failed')
        }
        setTestResult(data)
        return
      }

      const freshAnalysis = await ensureAnalysis()

      if (selectedFeature.id === 'chat') {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysisId: freshAnalysis.id, question }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error ?? 'Chat request failed')
        }
        setChatAnswer(data.answer ?? '')
        setChatRefs(data.references ?? [])
      }

      if (selectedFeature.id === 'docs') {
        downloadDocs()
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function renderLanding() {
    const topRowOrder: Array<Feature['id']> = ['run', 'explain', 'structure', 'chat', 'issues']
    const bottomRowOrder: Array<Feature['id']> = ['stats', 'test', 'docs', 'compare']

    const topRowFeatures = topRowOrder
      .map((featureId) => FEATURES.find((feature) => feature.id === featureId))
      .filter((feature): feature is Feature => Boolean(feature))

    const bottomRowFeatures = bottomRowOrder
      .map((featureId) => FEATURES.find((feature) => feature.id === featureId))
      .filter((feature): feature is Feature => Boolean(feature))

    function startFromLanding() {
      if (landingSelectedFeature) {
        const feature = FEATURES.find((item) => item.id === landingSelectedFeature)
        if (feature) {
          openFeatureWorkspace(feature)
          return
        }
      }
      setScreen('selector')
    }

    return (
      <section className="landing cinematic">
        <header className="hero-copy">
          <p className="kicker">AI-native repo intelligence</p>
          <h1>RepoLens</h1>
          <h2>Clarity for every repository</h2>
          <p className="subtitle">
            Deep analysis, runnable playbooks and documentation in one workspace. Pick a capability and launch instantly.
          </p>
          <div className="hero-badges">
            <span>Instant architecture maps</span>
            <span>Security-aware insights</span>
            <span>Docs and onboarding on tap</span>
          </div>
        </header>

        <div className="feature-rows" role="list">
          <div className="feature-row" role="listitem">
            {topRowFeatures.map((feature) => (
              <button
                key={feature.id}
                className={`plank-button ${landingSelectedFeature === feature.id ? 'active' : ''}`}
                onClick={() => setLandingSelectedFeature(feature.id)}
              >
                {feature.id === 'run' && 'Run Repo'}
                {feature.id === 'explain' && 'Explain Repo'}
                {feature.id === 'structure' && 'Repo Structure'}
                {feature.id === 'chat' && 'Chat with Repo'}
                {feature.id === 'issues' && 'Find Issues'}
              </button>
            ))}
          </div>

          <div className="feature-row" role="listitem">
            {bottomRowFeatures.map((feature) => (
              <button
                key={feature.id}
                className={`plank-button ${landingSelectedFeature === feature.id ? 'active' : ''}`}
                onClick={() => setLandingSelectedFeature(feature.id)}
              >
                {feature.id === 'stats' && 'Repo Stats'}
                {feature.id === 'test' && 'Run Tests'}
                {feature.id === 'docs' && 'Generate Docs'}
                {feature.id === 'compare' && 'Compare Repos'}
              </button>
            ))}
          </div>
        </div>

        <button className="cta hero-cta" onClick={startFromLanding}>
          Open Workspace
        </button>
      </section>
    )
  }

  function renderSelector() {
    return (
      <section>
        <header className="section-header">
          <h2>Choose One Feature</h2>
          <p>Select the capability you want to run first.</p>
        </header>

        <div className="selector-grid">
          {FEATURES.map((feature) => (
            <article key={feature.id} className="feature-card">
              <span>{feature.tag}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <button onClick={() => openFeatureWorkspace(feature)}>Use Feature</button>
            </article>
          ))}
        </div>

        <button className="ghost" onClick={() => setScreen('landing')}>
          Back to Landing
        </button>
      </section>
    )
  }

  function renderFeatureResult() {
    if (!selectedFeature) return null

    if (selectedFeature.id === 'run' && analysis) {
      return (
        <div className="result-block">
          <p>Detected Stack: {analysis.runIt.detectedStack.join(', ') || 'Unknown'}</p>
          <p>Install: {analysis.runIt.installCommand}</p>
          <p>Start: {analysis.runIt.startCommand}</p>
          <p>Sandbox: {analysis.runIt.previewUrl}</p>
        </div>
      )
    }

    if (selectedFeature.id === 'explain' && analysis) {
      return (
        <div className="result-block">
          <p>{analysis.explainIt.summary}</p>
          <ul>
            {analysis.explainIt.entryPoints.slice(0, 6).map((entry) => (
              <li key={entry.path}>{entry.path}</li>
            ))}
          </ul>
        </div>
      )
    }

    if (selectedFeature.id === 'structure' && analysis) {
      return (
        <div className="result-block">
          <p>Architecture</p>
          <ul>
            {analysis.structure.architecture.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p>Folder nodes: {analysis.structure.folderTree.length}</p>
          <p>Call edges: {analysis.structure.callGraph.length}</p>
          <p>Dependency nodes: {analysis.structure.dependencyGraph.length}</p>
        </div>
      )
    }

    if (selectedFeature.id === 'chat') {
      return (
        <div className="result-block">
          {chatAnswer ? <p>{chatAnswer}</p> : <p>Run this feature to get an answer.</p>}
          {chatRefs.length > 0 && (
            <ul>
              {chatRefs.map((ref) => (
                <li key={ref.path}>{ref.path}</li>
              ))}
            </ul>
          )}
        </div>
      )
    }

    if (selectedFeature.id === 'issues' && analysis) {
      return (
        <div className="result-block">
          <p>Security findings: {analysis.issues.security.length}</p>
          <p>Hardcoded secret hits: {analysis.issues.hardcodedSecrets.length}</p>
          <p>Code smells: {analysis.issues.smells.length}</p>
          <p>Missing error-handling spots: {analysis.issues.missingErrorHandling.length}</p>
        </div>
      )
    }

    if (selectedFeature.id === 'stats' && analysis) {
      return (
        <div className="result-block">
          <p>Commit velocity (90d): {analysis.stats.commitVelocity90d}</p>
          <p>Coverage estimate: {analysis.stats.testCoverageEstimate}%</p>
          <ul>
            {analysis.stats.mostChangedFiles.slice(0, 6).map((item) => (
              <li key={item.file}>
                {item.file} — {item.commits} commits
              </li>
            ))}
          </ul>
        </div>
      )
    }

    if (selectedFeature.id === 'test') {
      return (
        <div className="result-block">
          {testResult ? (
            <>
              <p>{testResult.summary}</p>
              <p>Detected test files: {testResult.testFiles}</p>
              <p>Commands: {testResult.detectedCommands.join(', ')}</p>
            </>
          ) : (
            <p>Run this feature to inspect test coverage and test gaps.</p>
          )}
        </div>
      )
    }

    if (selectedFeature.id === 'compare') {
      return (
        <div className="result-block">
          {compareResult ? (
            <>
              <p>{compareResult.recommendation}</p>
              <p>
                Left score hints — coverage {compareResult.left.stats.testCoverageEstimate}%, velocity {compareResult.left.stats.commitVelocity90d}
              </p>
              <p>
                Right score hints — coverage {compareResult.right.stats.testCoverageEstimate}%, velocity {compareResult.right.stats.commitVelocity90d}
              </p>
            </>
          ) : (
            <p>Run compare to see side-by-side recommendation.</p>
          )}
        </div>
      )
    }

    if (selectedFeature.id === 'docs' && analysis) {
      return (
        <div className="result-block">
          <p>Documentation generated for this repository.</p>
          <p>Markdown export is automatically downloaded when you run this feature.</p>
          <p>Preview title: {analysis.docs.readme.split('\n')[0]}</p>
        </div>
      )
    }

    if (selectedFeature.id === 'learn' && analysis) {
      return (
        <div className="result-block">
          <ol>
            {analysis.learning.tutorialSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>Important files: {analysis.learning.importantFiles.slice(0, 5).map((f) => f.path).join(', ')}</p>
        </div>
      )
    }

    return <div className="result-block">Run the selected feature to view results.</div>
  }

  function renderWorkspace() {
    if (!selectedFeature) return null

    return (
      <section>
        <header className="section-header">
          <p className="kicker">Feature Workspace</p>
          <h2>{selectedFeature.title}</h2>
          <p>{selectedFeature.description}</p>
        </header>

        <div className="workspace-card">
          <label>Repository URL</label>
          <input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} />

          {selectedFeature.id === 'compare' && (
            <>
              <label>Second Repository URL</label>
              <input value={repoUrlSecond} onChange={(event) => setRepoUrlSecond(event.target.value)} />
            </>
          )}

          {selectedFeature.id === 'chat' && (
            <>
              <label>Question</label>
              <input value={question} onChange={(event) => setQuestion(event.target.value)} />
            </>
          )}

          <button className="cta" onClick={runSelectedFeature} disabled={loading}>
            {loading ? 'Running...' : `Run ${selectedFeature.title}`}
          </button>
          {error && <p className="error">{error}</p>}
        </div>

        {renderFeatureResult()}

        <div className="workspace-actions">
          <button className="ghost" onClick={() => setScreen('selector')}>
            Back to Features
          </button>
          <button className="ghost" onClick={() => setScreen('landing')}>
            Back to Landing
          </button>
        </div>
      </section>
    )
  }

  return (
    <main className="app-shell">
      {screen === 'landing' && renderLanding()}
      {screen === 'selector' && renderSelector()}
      {screen === 'workspace' && renderWorkspace()}
    </main>
  )
}

export default App
