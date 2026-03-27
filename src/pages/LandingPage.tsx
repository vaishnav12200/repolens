import { motion } from 'framer-motion'
import { ThreeScene } from '../components/landing/ThreeScene'
import { TerminalPreview } from '../components/landing/TerminalPreview'

type Props = {
  repoUrl: string
  onRepoUrlChange: (value: string) => void
  onAnalyze: () => void
  loading: boolean
}

const features = [
  { title: 'Analyze', description: 'Stack detection, architecture extraction, AI summaries.' },
  { title: 'Visualize', description: 'Folder tree, call graph, dependency graph in one view.' },
  { title: 'Detect Issues', description: 'Secrets, TODO/FIXME, error-handling and dependency risk hints.' },
  { title: 'Run Sandbox', description: 'Auto-run cloned repos on random local ports.' },
  { title: 'AI Chat', description: 'Contextual Q&A across architecture and file references.' },
]

export function LandingPage({ repoUrl, onRepoUrlChange, onAnalyze, loading }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 p-6 md:p-8">
      <ThreeScene />

      <section className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl text-center"
        >
          <p className="text-xs uppercase tracking-[0.32em] text-neon-500">AI-native repository intelligence</p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-slate-100 md:text-7xl">RepoLens</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 md:text-lg">
            Analyze any public GitHub repository, visualize architecture in real time, detect issues, run local sandbox previews, and generate docs with AI.
          </p>

          <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 rounded-xl border border-neon-700/50 bg-slate-900/70 p-3 md:flex-row">
            <input
              value={repoUrl}
              onChange={(event) => onRepoUrlChange(event.target.value)}
              placeholder="https://github.com/owner/repo"
              className="h-11 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-neon-500"
            />
            <button
              onClick={onAnalyze}
              disabled={loading}
              className="h-11 rounded-lg bg-neon-600 px-5 text-sm font-medium text-slate-950 transition hover:bg-neon-500 disabled:opacity-60"
            >
              {loading ? 'Analyzing...' : 'Analyze Repo'}
            </button>
          </div>
        </motion.div>
      </section>

      <section className="relative z-10 mt-14">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
        >
          {features.map((feature) => (
            <article key={feature.title} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-neon-600 hover:shadow-neon">
              <h3 className="text-sm font-semibold text-neon-500">{feature.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">{feature.description}</p>
            </article>
          ))}
        </motion.div>
      </section>

      <section className="relative z-10 mt-12 grid items-start gap-6 lg:grid-cols-[1fr,1.25fr]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          className="rounded-xl border border-slate-800 bg-slate-900/70 p-5"
        >
          <h4 className="text-sm uppercase tracking-[0.22em] text-neon-500">Demo Preview</h4>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Terminal-first workflow with progressive analysis logs, actionable architecture insights, and generated implementation docs.
          </p>
        </motion.div>
        <TerminalPreview />
      </section>

      <footer className="relative z-10 mt-10 border-t border-slate-800 pt-5 text-center text-xs text-slate-500">
        RepoLens · Built for high-velocity engineering teams
      </footer>
    </div>
  )
}
