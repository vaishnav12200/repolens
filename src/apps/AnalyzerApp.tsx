import type { Analysis } from '../types/repolens'

type AnalyzerAppProps = {
  analysis: Analysis | null
}

export function AnalyzerApp({ analysis }: AnalyzerAppProps) {
  if (!analysis) {
    return (
      <div className="app-pad">
        <h3 className="app-title">Repo Analyzer</h3>
        <p className="app-muted">Run analyze &lt;repo_url&gt; in terminal to load repository insights.</p>
      </div>
    )
  }

  return (
    <div className="app-pad analyzer-layout">
      <section>
        <h3 className="app-title">Summary</h3>
        <p className="app-text">{analysis.explainIt.summary}</p>
      </section>

      <section>
        <h3 className="app-title">Detected Stack</h3>
        <ul className="analyzer-list">
          {analysis.explainIt.stackBreakdown.map((item) => (
            <li key={`${item.name}-${item.evidence}`}>
              <strong>{item.name}</strong> <span className="app-muted">({item.confidence})</span>
              <p className="app-muted">{item.evidence}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="analyzer-grid">
        <div className="analyzer-card">
          <p className="app-muted">Repo Score</p>
          <p className="metric">{analysis.stats.repoScore}</p>
        </div>
        <div className="analyzer-card">
          <p className="app-muted">Commit Velocity (90d)</p>
          <p className="metric">{analysis.stats.commitVelocity90d}</p>
        </div>
        <div className="analyzer-card">
          <p className="app-muted">Coverage Estimate</p>
          <p className="metric">{analysis.stats.testCoverageEstimate}%</p>
        </div>
      </section>
    </div>
  )
}
