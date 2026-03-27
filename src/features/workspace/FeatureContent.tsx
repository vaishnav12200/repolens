import { useEffect, type ReactNode } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-markdown'
import 'prismjs/themes/prism-tomorrow.css'
import { GraphView } from '../../components/visualization/GraphView'
import { TreeView } from '../../components/visualization/TreeView'
import type { Analysis, Capability, ChatResponse, CompareResult, TestResult } from '../../types/repolens'

type Props = {
  capability: Capability
  analysis: Analysis | null
  compareResult: CompareResult | null
  testResult: TestResult | null
  chatResult: ChatResponse | null
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <h3 className="mb-3 text-sm uppercase tracking-[0.2em] text-neon-500">{title}</h3>
      {children}
    </section>
  )
}

export function FeatureContent({ capability, analysis, compareResult, testResult, chatResult }: Props) {
  useEffect(() => {
    Prism.highlightAll()
  }, [capability, analysis])

  if (capability === 'compare') {
    if (!compareResult) {
      return <Card title="Compare">Run compare to view side-by-side repository quality insights.</Card>
    }

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Left Repository">
          <p className="text-xs text-slate-200">{compareResult.left.repoUrl}</p>
          <p className="mt-2 text-sm text-slate-300">Repo Score: {compareResult.left.stats.repoScore}</p>
          <p className="text-sm text-slate-300">Velocity (90d): {compareResult.left.stats.commitVelocity90d}</p>
          <p className="text-sm text-slate-300">Security flags: {compareResult.left.issues.security.length}</p>
        </Card>
        <Card title="Right Repository">
          <p className="text-xs text-slate-200">{compareResult.right.repoUrl}</p>
          <p className="mt-2 text-sm text-slate-300">Repo Score: {compareResult.right.stats.repoScore}</p>
          <p className="text-sm text-slate-300">Velocity (90d): {compareResult.right.stats.commitVelocity90d}</p>
          <p className="text-sm text-slate-300">Security flags: {compareResult.right.issues.security.length}</p>
        </Card>
        <Card title="Recommendation">
          <p className="text-sm text-slate-200">{compareResult.recommendation}</p>
        </Card>
      </div>
    )
  }

  if (!analysis) {
    return <Card title="Waiting">Analyze a repository to unlock feature results.</Card>
  }

  if (capability === 'explain') {
    return (
      <Card title="AI Explain">
        <p className="text-sm text-slate-200">{analysis.explainIt.summary}</p>
        <ul className="mt-3 space-y-1 text-xs text-slate-300">
          {analysis.explainIt.businessLogic.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </Card>
    )
  }

  if (capability === 'structure') {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Folder Tree">
          <TreeView paths={analysis.structure.folderTree} />
        </Card>
        <Card title="Call Graph">
          <GraphView edges={analysis.structure.callGraph} />
        </Card>
      </div>
    )
  }

  if (capability === 'issues') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Security">
          <ul className="space-y-1 text-xs text-slate-200">
            {analysis.issues.security.slice(0, 16).map((issue) => (
              <li key={`${issue.file}-${issue.title}`}>• {issue.title} — {issue.file}</li>
            ))}
          </ul>
        </Card>
        <Card title="Code Smells">
          <ul className="space-y-1 text-xs text-slate-200">
            {analysis.issues.smells.slice(0, 16).map((issue) => (
              <li key={`${issue.file}-${issue.title}`}>• {issue.title} — {issue.file}</li>
            ))}
          </ul>
        </Card>
      </div>
    )
  }

  if (capability === 'stats') {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Score">
          <p className="text-4xl font-semibold text-neon-500">{analysis.stats.repoScore}/10</p>
          <p className="text-sm text-slate-300">Coverage estimate: {analysis.stats.testCoverageEstimate}%</p>
          <p className="text-sm text-slate-300">Commit velocity (90d): {analysis.stats.commitVelocity90d}</p>
        </Card>
        <Card title="Most Changed Files">
          <ul className="space-y-1 text-xs text-slate-200">
            {analysis.stats.mostChangedFiles.slice(0, 12).map((item) => (
              <li key={item.file}>• {item.file} ({item.commits})</li>
            ))}
          </ul>
        </Card>
      </div>
    )
  }

  if (capability === 'run') {
    return (
      <Card title="Sandbox Runner">
        <p className="text-sm text-slate-300">Install: <span className="font-mono">{analysis.runIt.installCommand}</span></p>
        <p className="text-sm text-slate-300">Start: <span className="font-mono">{analysis.runIt.startCommand}</span></p>
        <p className="mt-3 text-sm text-neon-500">Preview URL: {analysis.runIt.previewUrl}</p>
      </Card>
    )
  }

  if (capability === 'chat') {
    return (
      <Card title="Repo Chat">
        <p className="text-sm text-slate-200">{chatResult?.answer ?? 'Ask a repository question to get contextual answers.'}</p>
        {chatResult?.references?.length ? (
          <ul className="mt-3 space-y-1 text-xs text-slate-300">
            {chatResult.references.map((reference) => (
              <li key={`${reference.path}-${reference.line ?? 0}`}>• {reference.path}{reference.line ? `:${reference.line}` : ''}</li>
            ))}
          </ul>
        ) : null}
      </Card>
    )
  }

  if (capability === 'docs') {
    const docsBlob = `${analysis.docs.readme}\n\n${analysis.docs.apiOverview}\n\n${analysis.docs.onboarding}`

    return (
      <Card title="Generated Docs">
        <pre className="max-h-[420px] overflow-auto rounded-lg border border-slate-800 bg-slate-950/90 p-3 text-xs">
          <code className="language-markdown">{docsBlob}</code>
        </pre>
      </Card>
    )
  }

  if (capability === 'compare') {
    return <Card title="Compare">Compare two repos to see which is healthier.</Card>
  }

  return (
    <Card title="Test Surface">
      <p className="text-sm text-slate-200">{testResult?.summary ?? 'Run test inspection for command and missing target hints.'}</p>
      <ul className="mt-3 space-y-1 text-xs text-slate-300">
        {(testResult?.suggestedMissingTests ?? []).slice(0, 12).map((file) => (
          <li key={file}>• {file}</li>
        ))}
      </ul>
    </Card>
  )
}
