import { FeatureContent } from '../features/workspace/FeatureContent'
import type { Analysis, Capability, ChatResponse, CompareResult, TestResult } from '../types/repolens'

type Props = {
  capability: Capability
  analysis: Analysis | null
  compareResult: CompareResult | null
  testResult: TestResult | null
  chatResult: ChatResponse | null
  error: string
}

export function OutputPanel({ capability, analysis, compareResult, testResult, chatResult, error }: Props) {
  return (
    <main className="output-panel">
      <header className="output-header">
        <p className="output-title">active mode: {capability}</p>
        <p className="output-hint">type commands below · try: analyze, issues, stats, chat, compare</p>
      </header>
      {error ? <p className="output-error">error: {error}</p> : null}
      <FeatureContent
        capability={capability}
        analysis={analysis}
        compareResult={compareResult}
        testResult={testResult}
        chatResult={chatResult}
      />
    </main>
  )
}
