export type FileRef = { path: string; line?: number }

export type Analysis = {
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
    entryPoints: FileRef[]
    businessLogic: string[]
  }
  structure: {
    folderTree: string[]
    architecture: string[]
    callGraph: Array<{ from: string; to: string }>
    dependencyGraph: Array<{ module: string; dependsOn: string[] }>
  }
  chatIndex: {
    hotspots: FileRef[]
    glossary: Array<{ term: string; meaning: string }>
  }
  issues: {
    security: Array<{ title: string; file: string; severity: 'low' | 'medium' | 'high' }>
    outdated: Array<{ packageName: string; current: string; wanted?: string; latest?: string; severity: 'low' | 'medium' | 'high' }>
    smells: Array<{ title: string; file: string }>
    missingErrorHandling: FileRef[]
    hardcodedSecrets: FileRef[]
  }
  stats: {
    mostChangedFiles: Array<{ file: string; commits: number }>
    busFactorByFolder: Array<{ folder: string; authors: number }>
    codeAgeHeatmap: Array<{ file: string; lastUpdated: string }>
    commitVelocity90d: number
    testCoverageEstimate: number
    repoScore: number
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
    importantFiles: FileRef[]
    glossary: Array<{ term: string; meaning: string }>
  }
  meta?: {
    aiUsed?: boolean
  }
}

export type ChatResponse = {
  answer: string
  references: FileRef[]
  aiUsed?: boolean
}

export type CompareResult = {
  left: {
    repoUrl: string
    stats: { testCoverageEstimate: number; commitVelocity90d: number; repoScore: number }
    issues: { security: Array<{ file: string }> }
  }
  right: {
    repoUrl: string
    stats: { testCoverageEstimate: number; commitVelocity90d: number; repoScore: number }
    issues: { security: Array<{ file: string }> }
  }
  recommendation: string
}

export type TestResult = {
  detectedCommands: string[]
  testFiles: number
  suggestedMissingTests: string[]
  summary: string
}

export type ExplorerTreeResponse = {
  analysisId: string
  repoUrl: string
  files: string[]
}

export type ExplorerFileResponse = {
  path: string
  content: string
}

export const CAPABILITIES = ['analyze', 'structure', 'issues', 'stats', 'run', 'chat', 'docs', 'compare'] as const
export type Capability = (typeof CAPABILITIES)[number]

export const CAPABILITY_LABELS: Record<Capability, string> = {
  analyze: 'Analyze',
  structure: 'Structure',
  issues: 'Issues',
  stats: 'Stats',
  run: 'Run',
  chat: 'Chat',
  docs: 'Docs',
  compare: 'Compare',
}
