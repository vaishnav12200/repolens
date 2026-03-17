import fs from 'fs';
const code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /function renderFeatureResult\(\) \{[\s\S]*?return <div className="result-block">Run the selected feature to view results\.<\/div>\s*\}/m;
const match = code.match(regex);
if (match) {
  const updatedCode = code.replace(
    regex,
    `function renderFeatureResult() {
    if (!selectedFeature) return null

    if (selectedFeature.id === 'run' && analysis) {
      return (
        <div className="result-block">
          <div className="list-group">
            <h4>Environment Setup</h4>
            <p>Detected Stack Config:</p>
            <div className="tag-list" style={{ marginBottom: '1rem' }}>
              {analysis.runIt.detectedStack.length ? (
                analysis.runIt.detectedStack.map((stack, i) => <span key={i} className="tag-pill">{stack}</span>)
              ) : (
                <span className="tag-pill">Unknown Stack</span>
              )}
            </div>
            
            <p>Playbook to run locally:</p>
            <div className="code-snippet">
              $ {analysis.runIt.installCommand}
              <br />
              $ {analysis.runIt.startCommand}
            </div>
            <p>Preview Environment: <a href={analysis.runIt.previewUrl} target="_blank" rel="noreferrer" style={{color: 'var(--accent)', textDecoration:'underline'}}>{analysis.runIt.previewUrl}</a></p>
          </div>
        </div>
      )
    }

    if (selectedFeature.id === 'explain' && analysis) {
      return (
        <div className="result-block">
          <div className="list-group">
            <h4>Repository Summary</h4>
            <p style={{ lineHeight: '1.6', color: 'var(--text)' }}>{analysis.explainIt.summary}</p>
          </div>
          
          <div className="list-group">
            <h4>Key Entry Points</h4>
            <div className="tag-list">
              {analysis.explainIt.entryPoints.slice(0, 6).map((entry) => (
                <span key={entry.path} className="tag-pill">{entry.path}</span>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (selectedFeature.id === 'structure' && analysis) {
      return (
        <div className="result-block">
          <div className="dashboard-grid">
            <div className="stat-card">
              <h4>Total Folders</h4>
              <p className="stat-value">{analysis.structure.folderTree.length}</p>
              <p className="stat-sub">Mapped in core tree</p>
            </div>
            <div className="stat-card">
              <h4>Call Edges</h4>
              <p className="stat-value">{analysis.structure.callGraph.length}</p>
              <p className="stat-sub">Analyzed boundaries</p>
            </div>
            <div className="stat-card">
              <h4>Dependency Nodes</h4>
              <p className="stat-value">{analysis.structure.dependencyGraph.length}</p>
              <p className="stat-sub">Linked modules</p>
            </div>
          </div>

          <div className="list-group">
            <h4>Architecture Overview</h4>
            <ul style={{ paddingLeft: '1.2rem', marginTop: '0.75rem' }}>
              {analysis.structure.architecture.map((line, idx) => (
                <li key={idx} style={{ marginBottom: '0.4rem', color: 'var(--text)' }}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      )
    }

    if (selectedFeature.id === 'chat') {
      return (
        <div className="result-block">
          <div className="list-group">
            <h4>AI Response</h4>
            {chatAnswer ? <p style={{ color: 'var(--text)' }}>{chatAnswer}</p> : <p>Ask a question and run this feature to get an answer.</p>}
          </div>
          
          {chatRefs.length > 0 && (
            <div className="list-group">
              <h4>References</h4>
              <div className="tag-list">
                {chatRefs.map((ref, idx) => (
                  <span key={idx} className="tag-pill">{ref.path}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (selectedFeature.id === 'issues' && analysis) {
      const allIssues = [
        ...analysis.issues.security.map(i => ({...i, type: 'Security', severity: i.severity as 'high' | 'medium'})),
        ...analysis.issues.hardcodedSecrets.map(i => ({ title: 'Hardcoded Secret risk detected', file: i.path, severity: 'high' as const, type: 'Secret' })),
        ...analysis.issues.smells.map(i => ({...i, severity: 'medium' as const, type: 'Code Smell' }))
      ];
      
      return (
        <div className="result-block">
          <div className="dashboard-grid" style={{ marginBottom: '0.5rem' }}>
            <div className="stat-card">
              <h4>Security Risk</h4>
              <p className="stat-value" style={{ color: analysis.issues.security.length ? '#ef4444' : 'var(--text)' }}>{analysis.issues.security.length}</p>
            </div>
            <div className="stat-card">
              <h4>Secrets</h4>
              <p className="stat-value">{analysis.issues.hardcodedSecrets.length}</p>
            </div>
            <div className="stat-card">
              <h4>Smells</h4>
              <p className="stat-value" style={{ color: analysis.issues.smells.length ? '#eab308' : 'var(--text)' }}>{analysis.issues.smells.length}</p>
            </div>
          </div>
          
          <div className="list-group">
            <h4>Discovered Issues File Traces</h4>
            {allIssues.length > 0 ? (
              <ul className="issue-list">
                {allIssues.map((issue, idx) => (
                  <li key={idx} className="issue-item">
                    <span className={issue.severity === 'high' ? 'issue-severity-high' : 'issue-severity-medium'}>{issue.severity}</span>
                    <div>
                      <div className="issue-title">[{issue.type}] {issue.title}</div>
                      <div className="issue-file">{issue.file}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No major issues found in sample phase.</p>
            )}
          </div>
        </div>
      )
    }

    if (selectedFeature.id === 'stats' && analysis) {
      return (
        <div className="result-block">
          <div className="dashboard-grid">
            <div className="stat-card">
              <h4>Commit Velocity</h4>
              <p className="stat-value">{analysis.stats.commitVelocity90d}</p>
              <p className="stat-sub">Commits in last 90 days</p>
            </div>
            <div className="stat-card">
              <h4>Test Coverage</h4>
              <p className="stat-value">{analysis.stats.testCoverageEstimate}%</p>
              <p className="stat-sub">Estimated surface ratio</p>
            </div>
          </div>

          <div className="list-group">
            <h4>Most Active Source Files</h4>
            <ul className="issue-list">
              {analysis.stats.mostChangedFiles.slice(0, 6).map((item) => (
                <li key={item.file} className="issue-item" style={{ alignItems: 'center' }}>
                  <span className="tag-pill" style={{ minWidth: '40px', textAlign: 'center' }}>{item.commits}x</span>
                  <span className="issue-file" style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{item.file}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )
    }

    if (selectedFeature.id === 'test') {
      return (
        <div className="result-block">
          {testResult ? (
            <>
              <div className="dashboard-grid">
                <div className="stat-card">
                  <h4>Test Files</h4>
                  <p className="stat-value">{testResult.testFiles}</p>
                  <p className="stat-sub">Detected specs/tests</p>
                </div>
                <div className="stat-card" style={{ gridColumn: 'span 2' }}>
                  <h4>Summary</h4>
                  <p style={{ margin: 0, marginTop: '0.5rem', color: 'var(--text)' }}>{testResult.summary}</p>
                </div>
              </div>
              <div className="list-group">
                <h4>Detected Commands</h4>
                <div className="code-snippet">
                  {testResult.detectedCommands.map(c => <div key={c}>$ {c}</div>)}
                </div>
              </div>
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
              <div className="list-group">
                <h4>Side-by-side Recommendation</h4>
                <p style={{ color: 'var(--text)', fontSize: '1.05rem' }}>{compareResult.recommendation}</p>
              </div>
              
              <div className="dashboard-grid" style={{ marginTop: '2rem' }}>
                <div className="stat-card">
                  <h4 style={{ color: 'var(--accent)'}}>Left Repo</h4>
                  <p className="stat-value">{compareResult.left.stats.testCoverageEstimate}%</p>
                  <p className="stat-sub">Est. Coverage</p>
                  <p className="stat-value" style={{ marginTop: '1rem', fontSize: '1.5rem'}}>{compareResult.left.stats.commitVelocity90d}</p>
                  <p className="stat-sub">90d commit velocity</p>
                </div>
                <div className="stat-card">
                  <h4 style={{ color: '#ef4444'}}>Right Repo</h4>
                  <p className="stat-value">{compareResult.right.stats.testCoverageEstimate}%</p>
                  <p className="stat-sub">Est. Coverage</p>
                  <p className="stat-value" style={{ marginTop: '1rem', fontSize: '1.5rem'}}>{compareResult.right.stats.commitVelocity90d}</p>
                  <p className="stat-sub">90d commit velocity</p>
                </div>
              </div>
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
          <div className="list-group">
            <h4>Documentation Export</h4>
            <p>Full Markdown export is automatically generated and downloading to your local machine.</p>
            <div className="code-snippet" style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
              {analysis.docs.readme.split('\\n').slice(0, 5).join('\\n')}...
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Preview mapped from analysis generator</p>
          </div>
        </div>
      )
    }

    if (selectedFeature.id === 'learn' && analysis) {
      return (
        <div className="result-block">
          <div className="list-group">
            <h4>Recommended Tutorial Pathway</h4>
            <ul className="issue-list">
              {analysis.learning.tutorialSteps.map((step, idx) => (
                <li key={idx} className="issue-item" style={{ alignItems: 'center' }}>
                  <span className="tag-pill" style={{ background: 'var(--accent)', color: 'black', fontWeight: 'bold' }}>{idx + 1}</span>
                  <span style={{ color: 'var(--text)' }}>{step}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="list-group">
            <h4>Must-read Files</h4>
            <div className="tag-list">
              {analysis.learning.importantFiles.slice(0, 5).map((f) => (
                <span key={f.path} className="tag-pill">{f.path}</span>
              ))}
            </div>
          </div>
        </div>
      )
    }

    return <div className="result-block">Run the selected feature to view results.</div>
  }`
  );
  fs.writeFileSync('src/App.tsx', updatedCode);
  console.log("Success");
} else {
  console.log("Not matched");
}
