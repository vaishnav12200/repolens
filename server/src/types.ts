export type StackItem = {
  name: string
  confidence: 'high' | 'medium' | 'low'
  evidence: string
}

export type FileRef = {
  path: string
  line?: number
}

export type RepoAnalysis = {
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
    stackBreakdown: StackItem[]
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
}

export type ChatRequest = {
  analysisId: string
  question: string
}

export type CompareResult = {
  left: Pick<RepoAnalysis, 'repoUrl' | 'runIt' | 'explainIt' | 'stats' | 'issues'>
  right: Pick<RepoAnalysis, 'repoUrl' | 'runIt' | 'explainIt' | 'stats' | 'issues'>
  recommendation: string
}
