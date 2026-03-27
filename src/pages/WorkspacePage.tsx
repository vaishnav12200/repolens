import { motion } from 'framer-motion'
import { CapabilitySelector } from '../components/workspace/CapabilitySelector'
import { TerminalPanel } from '../components/workspace/TerminalPanel'
import { FeatureContent } from '../features/workspace/FeatureContent'
import type { Analysis, Capability, ChatResponse, CompareResult, TestResult } from '../types/repolens'

type Props = {
  capability: Capability
  onCapabilityChange: (capability: Capability) => void
  repoUrl: string
  repoUrlSecond: string
  question: string
  onRepoUrlChange: (value: string) => void
  onRepoUrlSecondChange: (value: string) => void
  onQuestionChange: (value: string) => void
  onRunAction: () => void
  onBack: () => void
  onDownloadDocs: () => void
  loading: boolean
  error: string
  analysis: Analysis | null
  compareResult: CompareResult | null
  testResult: TestResult | null
  chatResult: ChatResponse | null
  terminalLines: Array<{ id: string; text: string }>
  history: string[]
}

export function WorkspacePage({
  capability,
  onCapabilityChange,
  repoUrl,
  repoUrlSecond,
  question,
  onRepoUrlChange,
  onRepoUrlSecondChange,
  onQuestionChange,
  onRunAction,
  onBack,
  onDownloadDocs,
  loading,
  error,
  analysis,
  compareResult,
  testResult,
  chatResult,
  terminalLines,
  history,
}: Props) {
  return (
    <div className="grid min-h-[76vh] gap-4 xl:grid-cols-[220px,1fr,300px]">
      <div className="space-y-3">
        <CapabilitySelector active={capability} onChange={onCapabilityChange} />
        <button
          onClick={onBack}
          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 transition hover:border-neon-600"
        >
          Back to Landing
        </button>
      </div>

      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
      >
        <header className="mb-4 grid gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 lg:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Primary Repo URL</label>
            <input
              value={repoUrl}
              onChange={(event) => onRepoUrlChange(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-neon-500"
            />
          </div>

          {capability === 'compare' ? (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Secondary Repo URL</label>
              <input
                value={repoUrlSecond}
                onChange={(event) => onRepoUrlSecondChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-neon-500"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Repo Question</label>
              <input
                value={question}
                onChange={(event) => onQuestionChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-neon-500"
              />
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              onClick={onRunAction}
              disabled={loading}
              className="h-10 rounded-lg bg-neon-600 px-4 text-sm font-medium text-slate-950 transition hover:bg-neon-500 disabled:opacity-60"
            >
              {loading ? 'Processing...' : `Run ${capability}`}
            </button>
            {capability === 'docs' && analysis ? (
              <button
                onClick={onDownloadDocs}
                className="h-10 rounded-lg border border-neon-600/80 bg-neon-600/15 px-4 text-sm text-neon-500 transition hover:bg-neon-600/25"
              >
                Download
              </button>
            ) : null}
          </div>
        </header>

        {error ? <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">{error}</p> : null}

        <FeatureContent
          capability={capability}
          analysis={analysis}
          compareResult={compareResult}
          testResult={testResult}
          chatResult={chatResult}
        />

        {history.length > 0 ? (
          <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <h4 className="text-xs uppercase tracking-[0.2em] text-neon-500">History</h4>
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {history.slice(0, 6).map((url) => (
                <li key={url}>• {url}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </motion.main>

      <TerminalPanel lines={terminalLines} />
    </div>
  )
}
