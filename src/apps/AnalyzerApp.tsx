import type { Analysis } from '../types/repolens'
import type { Capability } from '../types/repolens'

type AnalyzerAppProps = {
  analysis: Analysis | null
  capability: Capability
}

export function AnalyzerApp({ analysis, capability }: AnalyzerAppProps) {
  if (!analysis) {
    return (
      <div className="app-pad">
        <h3 className="app-title">Repo Analyzer</h3>
        <p className="app-muted">Run analyze &lt;repo_url&gt; in terminal to load repository insights.</p>
      </div>
    )
  }

  if (capability === 'structure') {
    return (
      <div className="app-pad analyzer-layout">
        <section>
          <h3 className="app-title">Structure</h3>
          <ul className="analyzer-list">
            {analysis.structure.architecture.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="app-title">Folder Tree (Top)</h3>
          <ul className="analyzer-list">
            {analysis.structure.folderTree.slice(0, 24).map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  if (capability === 'issues') {
    return (
      <div className="app-pad analyzer-layout">
        <section>
          <h3 className="app-title">Security</h3>
          <ul className="analyzer-list">
            {analysis.issues.security.slice(0, 16).map((issue) => (
              <li key={`${issue.file}-${issue.title}`}>
                <strong>{issue.title}</strong>
                <p className="app-muted">{issue.file} · {issue.severity}</p>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="app-title">Code Smells</h3>
          <ul className="analyzer-list">
            {analysis.issues.smells.slice(0, 16).map((issue) => (
              <li key={`${issue.file}-${issue.title}`}>
                <strong>{issue.title}</strong>
                <p className="app-muted">{issue.file}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  if (capability === 'stats') {
    return (
      <div className="app-pad analyzer-layout">
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
        <section>
          <h3 className="app-title">Most Changed Files</h3>
          <ul className="analyzer-list">
            {analysis.stats.mostChangedFiles.slice(0, 16).map((item) => (
              <li key={item.file}>{item.file} ({item.commits})</li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  if (capability === 'run') {
    return (
      <div className="app-pad analyzer-layout">
        <section>
          <h3 className="app-title">Sandbox Run</h3>
          <p className="app-text">Install command: {analysis.runIt.installCommand}</p>
          <p className="app-text">Start command: {analysis.runIt.startCommand}</p>
          <p className="app-text">
            Preview URL:{' '}
            <a href={analysis.runIt.previewUrl} target="_blank" rel="noreferrer" className="terminal-link">
              {analysis.runIt.previewUrl}
            </a>
          </p>
        </section>
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
