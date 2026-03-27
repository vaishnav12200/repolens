import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join, relative } from 'node:path'
import { promisify } from 'node:util'
import crypto from 'node:crypto'
import type { CompareResult, FileRef, RepoAnalysis, StackItem } from './types.js'

const execFileAsync = promisify(execFile)

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.venv',
  'venv',
  'target',
])

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.md',
  '.json',
  '.yml',
  '.yaml',
])

type LocalRepo = {
  dir: string
  files: string[]
  sampleContents: Array<{ file: string; content: string }>
}

async function cloneRepo(repoUrl: string): Promise<LocalRepo> {
  const dir = await mkdtemp(join(tmpdir(), 'repolens-'))
  try {
    await execFileAsync('git', ['clone', '--depth', '1', repoUrl, dir], { timeout: 120000 })
    const files = await walkFiles(dir)
    const sampleContents = await readSampleContents(dir, files)
    return { dir, files, sampleContents }
  } catch (error) {
    await rm(dir, { recursive: true, force: true })
    throw error
  }
}

async function walkFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true })
  const out: string[] = []

  for (const entry of entries) {
    const full = join(current, entry.name)
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue
      }
      out.push(...(await walkFiles(root, full)))
    } else if (entry.isFile()) {
      out.push(relative(root, full))
    }
  }

  return out
}

async function readSampleContents(root: string, files: string[]) {
  const selected = files
    .filter((file) => TEXT_EXTENSIONS.has(extname(file)))
    .slice(0, 120)

  const content = await Promise.all(
    selected.map(async (file) => {
      const raw = await readFile(join(root, file), 'utf-8')
      return { file, content: raw.slice(0, 5000) }
    }),
  )

  return content
}

async function readPackageJson(root: string, files: string) {
  try {
    if (files !== 'package.json') {
      return null
    }

    const raw = await readFile(join(root, files), 'utf-8')
    return JSON.parse(raw) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
  } catch {
    return null
  }
}

function detectStack(files: string[]): StackItem[] {
  const joined = new Set(files)
  const stack: StackItem[] = []

  const add = (name: string, confidence: StackItem['confidence'], evidence: string) => {
    stack.push({ name, confidence, evidence })
  }

  if (joined.has('package.json')) add('Node.js', 'high', 'Found package.json')
  if (files.some((f) => f.endsWith('.tsx') || f.endsWith('.jsx'))) add('Frontend SPA', 'high', 'Found JSX/TSX source files')
  if (joined.has('requirements.txt') || files.some((f) => f.endsWith('.py'))) add('Python', 'medium', 'Found Python files or requirements.txt')
  if (joined.has('pom.xml') || files.some((f) => f.endsWith('.java'))) add('Java', 'medium', 'Found Java sources or Maven config')
  if (joined.has('go.mod') || files.some((f) => f.endsWith('.go'))) add('Go', 'medium', 'Found Go files or go.mod')
  if (joined.has('Cargo.toml') || files.some((f) => f.endsWith('.rs'))) add('Rust', 'medium', 'Found Rust files or Cargo.toml')
  if (joined.has('Dockerfile')) add('Containerized deployment', 'low', 'Found Dockerfile')

  if (joined.has('vite.config.ts') || joined.has('vite.config.js')) add('Vite', 'high', 'Found Vite config')
  if (joined.has('next.config.js') || joined.has('next.config.ts')) add('Next.js', 'high', 'Found Next.js config')
  if (joined.has('angular.json')) add('Angular', 'high', 'Found angular.json')
  if (joined.has('tsconfig.json')) add('TypeScript', 'high', 'Found tsconfig.json')

  return stack
}

function detectEntryPoints(files: string[]): FileRef[] {
  const candidates = ['src/main.tsx', 'src/main.ts', 'src/index.tsx', 'src/index.ts', 'server.js', 'app.py', 'main.py']
  return files
    .filter((file) => candidates.includes(file) || /^(src|server)\/.*(index|main)\.(ts|tsx|js|py)$/.test(file))
    .slice(0, 8)
    .map((file) => ({ path: file }))
}

function summarizeBusinessLogic(sampleContents: Array<{ file: string; content: string }>): string[] {
  const hints: string[] = []
  const all = sampleContents.map((x) => x.content.toLowerCase()).join('\n')

  if (all.includes('auth') || all.includes('jwt')) hints.push('Implements authentication/authorization flows.')
  if (all.includes('payment') || all.includes('stripe')) hints.push('Contains payment or billing related logic.')
  if (all.includes('order')) hints.push('Handles order lifecycle operations (create/read/update).')
  if (all.includes('webhook')) hints.push('Processes asynchronous events via webhooks.')
  if (all.includes('queue') || all.includes('worker')) hints.push('Uses background processing patterns.')

  if (hints.length === 0) {
    hints.push('Core business logic appears domain-specific; inspect service/controller modules for exact flows.')
  }

  return hints
}

function buildFolderTree(files: string[]): string[] {
  return files.slice(0, 200)
}

function buildArchitecture(files: string[]): string[] {
  const lines: string[] = []
  const hasFrontend = files.some((f) => /src\/.*\.(tsx|jsx|html|css)$/.test(f))
  const hasBackend = files.some((f) => /(server|api|backend)\//.test(f) || /\.(py|go|java)$/.test(f))
  const hasDb = files.some((f) => /(prisma|migrations|schema|database|models)\//.test(f))

  if (hasFrontend) lines.push('Frontend client handles user interactions and API calls.')
  if (hasBackend) lines.push('Backend/service layer contains core business logic and integrations.')
  if (hasDb) lines.push('Persistence layer likely managed via ORM/schema/migration files.')
  if (!hasFrontend && !hasBackend) lines.push('Architecture appears library-centric rather than multi-tier app.')

  return lines
}

function extractImports(content: string): string[] {
  const deps = new Set<string>()
  const importRegex = /import\s+[^'"`]+['"`]([^'"`]+)['"`]/g
  const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g

  for (const regex of [importRegex, requireRegex]) {
    let match: RegExpExecArray | null
    while ((match = regex.exec(content)) !== null) {
      deps.add(match[1])
    }
  }

  return [...deps]
}

function buildDependencyGraph(sampleContents: Array<{ file: string; content: string }>) {
  return sampleContents
    .filter((f) => /\.(ts|tsx|js|jsx)$/.test(f.file))
    .slice(0, 60)
    .map((file) => ({ module: file.file, dependsOn: extractImports(file.content).slice(0, 12) }))
}

function buildCallGraph(sampleContents: Array<{ file: string; content: string }>) {
  const edges: Array<{ from: string; to: string }> = []
  const callRegex = /([A-Za-z_][A-Za-z0-9_]*)\(/g

  for (const { file, content } of sampleContents.slice(0, 40)) {
    const seen = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = callRegex.exec(content)) !== null) {
      const callee = match[1]
      if (!seen.has(callee) && callee.length > 2) {
        edges.push({ from: file, to: callee })
        seen.add(callee)
      }
      if (seen.size > 15) break
    }
  }

  return edges.slice(0, 200)
}

function findIssues(sampleContents: Array<{ file: string; content: string }>, files: string[]) {
  const security: RepoAnalysis['issues']['security'] = []
  const smells: RepoAnalysis['issues']['smells'] = []
  const missingErrorHandling: FileRef[] = []
  const hardcodedSecrets: FileRef[] = []

  for (const { file, content } of sampleContents) {
    if (/eval\(|new Function\(/.test(content)) {
      security.push({ title: 'Dynamic code execution risk', file, severity: 'high' })
    }
    if (/TODO|FIXME/.test(content)) {
      smells.push({ title: 'Contains TODO/FIXME markers', file })
    }
    if (/await\s+\w+\([^)]*\);/.test(content) && !/try\s*\{/.test(content)) {
      missingErrorHandling.push({ path: file })
    }
    if (/api[_-]?key\s*=\s*['"][A-Za-z0-9_-]{16,}['"]|secret\s*=\s*['"][A-Za-z0-9_-]{10,}['"]/i.test(content)) {
      hardcodedSecrets.push({ path: file })
      security.push({ title: 'Potential hardcoded secret', file, severity: 'high' })
    }
  }

  const outdated: RepoAnalysis['issues']['outdated'] = []

  return {
    security: security.slice(0, 20),
    outdated,
    smells: smells.slice(0, 20),
    missingErrorHandling: missingErrorHandling.slice(0, 20),
    hardcodedSecrets: hardcodedSecrets.slice(0, 20),
  }
}

function findPotentiallyOutdatedDependencies(
  packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null,
): RepoAnalysis['issues']['outdated'] {
  if (!packageJson) {
    return []
  }

  const mergedDeps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  }

  return Object.entries(mergedDeps)
    .filter(([, version]) => /^0\./.test(version.replace(/^[~^]/, '')) || /^\d+\.\d+\.\d+$/.test(version))
    .slice(0, 20)
    .map(([packageName, current]) => ({
      packageName,
      current,
      severity: /^0\./.test(current.replace(/^[~^]/, '')) ? 'medium' : 'low',
    }))
}

async function getMostChangedFiles(repoDir: string) {
  const { stdout } = await execFileAsync('git', ['-C', repoDir, 'log', '--name-only', '--pretty=format:'], {
    timeout: 30000,
  })
  const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean)
  const counts = new Map<string, number>()
  for (const line of lines) {
    counts.set(line, (counts.get(line) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([file, commits]) => ({ file, commits }))
}

async function getCommitVelocity(repoDir: string) {
  const { stdout } = await execFileAsync(
    'git',
    ['-C', repoDir, 'rev-list', '--count', '--since=90.days', 'HEAD'],
    { timeout: 30000 },
  )
  return Number.parseInt(stdout.trim(), 10) || 0
}

async function getBusFactor(repoDir: string) {
  const { stdout } = await execFileAsync('git', ['-C', repoDir, 'shortlog', '-sne', 'HEAD'], { timeout: 30000 })
  const authors = stdout.split('\n').filter(Boolean).length
  return [
    { folder: 'root', authors },
    { folder: 'src', authors: Math.max(1, Math.ceil(authors * 0.7)) },
    { folder: 'tests', authors: Math.max(1, Math.ceil(authors * 0.4)) },
  ]
}

async function getCodeAgeHeatmap(repoDir: string, files: string[]) {
  const selected = files.slice(0, 20)
  const items: Array<{ file: string; lastUpdated: string }> = []

  for (const file of selected) {
    const target = join(repoDir, file)
    const fileStat = await stat(target)
    items.push({ file, lastUpdated: fileStat.mtime.toISOString().slice(0, 10) })
  }

  return items
}

function estimateCoverage(files: string[]) {
  const codeFiles = files.filter((f) => /\.(ts|tsx|js|jsx|py|go|java|rs)$/.test(f) && !/\.d\.ts$/.test(f))
  const testFiles = files.filter((f) => /(test|spec)\.(ts|tsx|js|jsx|py|go|java|rs)$/.test(f) || /__tests__/.test(f))
  const ratio = codeFiles.length === 0 ? 0 : Math.round((testFiles.length / codeFiles.length) * 100)

  return {
    coverage: Math.min(95, ratio),
    testFiles: testFiles.length,
    untested: codeFiles
      .filter((f) => !testFiles.some((t) => basename(t).replace(/(test|spec)\./, '') === basename(f)))
      .slice(0, 20),
  }
}

function calculateRepoScore(input: {
  coverage: number
  velocity: number
  securityFindings: number
  smellFindings: number
  stackSignals: number
}) {
  const velocityScore = Math.min(30, input.velocity)
  const coverageScore = Math.min(40, input.coverage)
  const stackScore = Math.min(20, input.stackSignals * 4)
  const riskPenalty = Math.min(50, input.securityFindings * 8 + input.smellFindings * 2)
  const raw = coverageScore + velocityScore + stackScore - riskPenalty + 10

  return Math.max(0, Math.min(10, Number((raw / 10).toFixed(1))))
}

function generateDocs(repoUrl: string, stack: StackItem[], entryPoints: FileRef[], logic: string[]) {
  const readme = `# RepoLens Generated README\n\n## Source\n${repoUrl}\n\n## What this project does\n${logic.map((l) => `- ${l}`).join('\n')}\n\n## Quick Start\n- Install dependencies\n- Run the app\n- Inspect entry points below\n\n## Entry Points\n${entryPoints.map((e) => `- ${e.path}`).join('\n')}`

  const apiOverview = `## API/Service Overview\n${stack.map((s) => `- ${s.name}: ${s.evidence}`).join('\n')}`
  const onboarding = `## Onboarding Guide\n1. Read repository root docs\n2. Start with ${entryPoints[0]?.path ?? 'primary entry point'}\n3. Follow request/data flow through services\n4. Run tests and inspect failures`

  return { readme, apiOverview, onboarding }
}

export function buildGlossary(sampleContents: Array<{ file: string; content: string }>) {
  const terms = new Map<string, string>()
  const candidates = ['auth', 'webhook', 'worker', 'queue', 'controller', 'service', 'repository', 'dto']
  const dictionary: Record<string, string> = {
    auth: 'Authentication and authorization logic.',
    webhook: 'HTTP callback triggered by external systems.',
    worker: 'Background process for asynchronous jobs.',
    queue: 'Buffered workload processing mechanism.',
    controller: 'Layer handling request routing and validation.',
    service: 'Business logic abstraction layer.',
    repository: 'Data access abstraction over storage.',
    dto: 'Data Transfer Object for validated payload structures.',
  }

  const corpus = sampleContents.map((s) => s.content.toLowerCase()).join('\n')
  for (const term of candidates) {
    if (corpus.includes(term)) terms.set(term, dictionary[term])
  }

  return [...terms.entries()].map(([term, meaning]) => ({ term, meaning }))
}

export async function analyzeRepo(repoUrl: string): Promise<RepoAnalysis & { _repoDir: string }> {
  const { dir, files, sampleContents } = await cloneRepo(repoUrl)

  const stack = detectStack(files)
  const entryPoints = detectEntryPoints(files)
  const logic = summarizeBusinessLogic(sampleContents)
  const packageJsonPath = files.find((f) => f === 'package.json')
  const packageJson = packageJsonPath ? await readPackageJson(dir, packageJsonPath) : null
  const issues = findIssues(sampleContents, files)
  const outdated = findPotentiallyOutdatedDependencies(packageJson)
  issues.outdated = outdated.length > 0 ? outdated : issues.outdated
  const [mostChangedFiles, commitVelocity90d, busFactorByFolder, codeAgeHeatmap] = await Promise.all([
    getMostChangedFiles(dir),
    getCommitVelocity(dir),
    getBusFactor(dir),
    getCodeAgeHeatmap(dir, files),
  ])

  const testing = estimateCoverage(files)
  const repoScore = calculateRepoScore({
    coverage: testing.coverage,
    velocity: commitVelocity90d,
    securityFindings: issues.security.length,
    smellFindings: issues.smells.length,
    stackSignals: stack.length,
  })
  const docs = generateDocs(repoUrl, stack, entryPoints, logic)
  const glossary = buildGlossary(sampleContents)
  const learning = {
    tutorialSteps: [
      'Start with the top-level README and package metadata.',
      'Open the first entry point and follow routing/bootstrap logic.',
      'Trace one user action end-to-end using controllers/services.',
      'Inspect data models and persistence adapters.',
      'Run tests and map uncovered paths from failing/absent cases.',
    ],
    importantFiles: entryPoints.length > 0 ? entryPoints : files.slice(0, 10).map((path) => ({ path })),
    glossary,
  }

  // NOTE: intentional leak of 'dir' out to be picked up by startRepo later.
  return {
    _repoDir: dir,
    id: crypto.randomUUID(),
    repoUrl,
    analyzedAt: new Date().toISOString(),
    runIt: {
      detectedStack: stack.map((s) => s.name),
      installCommand: stack.some((s) => s.name === 'Python') ? 'pip install -r requirements.txt' : 'npm install',
      startCommand: stack.some((s) => s.name === 'Python') ? 'python app.py' : stack.some((s) => s.name === 'Vite') ? 'npm run dev' : 'npm start',
      previewUrl: 'Will trigger when actual Run hit...',
      notes: [],
    },
    explainIt: { summary: `Analyzed ${files.length} files. ${logic[0] ?? ''}`, stackBreakdown: stack, entryPoints, businessLogic: logic },
    structure: { folderTree: buildFolderTree(files), architecture: buildArchitecture(files), callGraph: buildCallGraph(sampleContents), dependencyGraph: buildDependencyGraph(sampleContents) },
    issues,
    stats: {
      mostChangedFiles,
      commitVelocity90d,
      busFactorByFolder,
      codeAgeHeatmap,
      testCoverageEstimate: testing.coverage,
      repoScore,
    },
    testing: { detectedTestCommands: ['npm test'], testFiles: testing.testFiles, untestedCandidateFiles: testing.untested },
    chatIndex: { hotspots: [], glossary: [] },
    docs,
    learning,
  }
}

export function compareAnalyses(left: RepoAnalysis, right: RepoAnalysis): CompareResult {
  const leftScore = left.stats.testCoverageEstimate + left.stats.commitVelocity90d - left.issues.security.length * 10
  const rightScore = right.stats.testCoverageEstimate + right.stats.commitVelocity90d - right.issues.security.length * 10

  const recommendation =
    leftScore === rightScore
      ? 'Both repositories are closely matched. Choose based on ecosystem fit and maintainers.'
      : leftScore > rightScore
        ? 'Left repository looks stronger on activity/quality heuristics.'
        : 'Right repository looks stronger on activity/quality heuristics.'

  return {
    left: {
      repoUrl: left.repoUrl,
      runIt: left.runIt,
      explainIt: left.explainIt,
      stats: left.stats,
      issues: left.issues,
    },
    right: {
      repoUrl: right.repoUrl,
      runIt: right.runIt,
      explainIt: right.explainIt,
      stats: right.stats,
      issues: right.issues,
    },
    recommendation,
  }
}

export function answerQuestion(analysis: RepoAnalysis, question: string) {
  const query = question.toLowerCase()
  const hits = analysis.structure.folderTree
    .filter((file: string) => file.toLowerCase().includes(query.split(' ')[0]))
    .slice(0, 6)

  let answer = 'I could not find an exact match, but start with the entry points and service folders.'
  if (query.includes('auth')) {
    answer = 'Authentication logic is usually found in middleware, guards, or auth service files. Check files containing auth, jwt, and middleware.'
  } else if (query.includes('payment')) {
    answer = 'Payment flow generally starts in API handlers and then calls payment provider SDK wrappers. Look for files referencing stripe, billing, or checkout.'
  } else if (query.includes('form')) {
    answer = 'Form submissions typically pass from UI handlers to API endpoints, then validation/service layers.'
  }

  return {
    answer,
    references: hits.map((path: string) => ({ path })),
  }
}
