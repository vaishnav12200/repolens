import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, relative } from 'node:path'
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
      scripts?: Record<string, string>
    }
  } catch {
    return null
  }
}

function detectPackageManager(files: string[]) {
  if (files.includes('pnpm-lock.yaml')) return 'pnpm'
  if (files.includes('yarn.lock')) return 'yarn'
  if (files.includes('bun.lockb') || files.includes('bun.lock')) return 'bun'
  return 'npm'
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
  const allDirs = new Set<string>()

  for (const file of files.slice(0, 900)) {
    const folder = dirname(file)
    if (folder === '.') {
      continue
    }

    const parts = folder.split('/').filter(Boolean)
    for (let index = 0; index < parts.length; index += 1) {
      allDirs.add(parts.slice(0, index + 1).join('/'))
    }
  }

  return [...allDirs, ...files.slice(0, 900)]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 900)
}

function buildArchitecture(files: string[]): string[] {
  const lines: string[] = []
  const hasFrontend = files.some((f) => /src\/.*\.(tsx|jsx|html|css)$/.test(f))
  const hasBackend = files.some((f) => /(server|api|backend)\//.test(f) || /\.(py|go|java)$/.test(f))
  const hasDb = files.some((f) => /(prisma|migrations|schema|database|models)\//.test(f))
  const hasTests = files.some((f) => /(test|spec)\.(ts|tsx|js|jsx|py|go|java|rs)$/.test(f) || /__tests__/.test(f))
  const hasCi = files.some((f) => /^\.github\/workflows\/.+\.ya?ml$/.test(f) || /^\.gitlab-ci\.yml$/.test(f))
  const hasDocker = files.some((f) => /(^|\/)Dockerfile$/.test(f) || /docker-compose\.ya?ml$/.test(f))

  if (hasFrontend) lines.push('Frontend client handles user interactions and API calls.')
  if (hasBackend) lines.push('Backend/service layer contains core business logic and integrations.')
  if (hasDb) lines.push('Persistence layer likely managed via ORM/schema/migration files.')
  if (hasTests) lines.push('Test surface exists and can be used to validate behavior changes.')
  if (hasCi) lines.push('CI pipeline configuration is present for automated checks/deploy workflows.')
  if (hasDocker) lines.push('Containerization artifacts are present for local/prod environment consistency.')
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

function findLineForPattern(content: string, pattern: RegExp) {
  const lines = content.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) {
      return index + 1
    }
  }
  return undefined
}

function findIssues(sampleContents: Array<{ file: string; content: string }>) {
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
      missingErrorHandling.push({ path: file, line: findLineForPattern(content, /await\s+\w+\([^)]*\);/) })
    }
    if (/api[_-]?key\s*=\s*['"][A-Za-z0-9_-]{16,}['"]|secret\s*=\s*['"][A-Za-z0-9_-]{10,}['"]/i.test(content)) {
      hardcodedSecrets.push({ path: file, line: findLineForPattern(content, /api[_-]?key\s*=\s*['"][A-Za-z0-9_-]{16,}['"]|secret\s*=\s*['"][A-Za-z0-9_-]{10,}['"]/i) })
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

function detectTestCommands(
  packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> } | null,
  files: string[],
) {
  const commands = new Set<string>()

  if (packageJson?.scripts?.test) {
    commands.add('npm test')
  }

  if (files.some((file) => /(^|\/)tests?\//.test(file) && file.endsWith('.py'))) {
    commands.add('pytest')
  }

  if (files.some((file) => file.endsWith('_test.go') || file.endsWith('.test.go'))) {
    commands.add('go test ./...')
  }

  if (files.some((file) => file.endsWith('.rs'))) {
    commands.add('cargo test')
  }

  if (commands.size === 0) {
    commands.add('npm test')
  }

  return [...commands]
}

function inferRuntimeCommands(
  stack: StackItem[],
  packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> } | null,
  files: string[],
) {
  const packageManager = detectPackageManager(files)
  const runWithManager = (scriptName: string) => {
    if (packageManager === 'npm') return `npm run ${scriptName}`
    if (packageManager === 'pnpm') return `pnpm ${scriptName}`
    if (packageManager === 'yarn') return `yarn ${scriptName}`
    return `bun run ${scriptName}`
  }
  const installWithManager =
    packageManager === 'npm'
      ? 'npm install'
      : packageManager === 'pnpm'
        ? 'pnpm install'
        : packageManager === 'yarn'
          ? 'yarn install --frozen-lockfile || yarn install'
          : 'bun install'

  if (stack.some((item) => item.name === 'Python')) {
    if (files.includes('pyproject.toml')) {
      return {
        installCommand: 'python -m pip install . || pip install .',
        startCommand: files.includes('main.py') ? 'python main.py' : files.includes('app.py') ? 'python app.py' : 'python -m http.server 8000',
      }
    }

    return {
      installCommand: 'python -m pip install -r requirements.txt || pip install -r requirements.txt',
      startCommand: files.includes('main.py') ? 'python main.py' : files.includes('app.py') ? 'python app.py' : 'python -m http.server 8000',
    }
  }

  if (stack.some((item) => item.name === 'Go')) {
    return {
      installCommand: 'go mod download',
      startCommand: files.includes('main.go') ? 'go run main.go' : 'go run ./...',
    }
  }

  if (stack.some((item) => item.name === 'Rust')) {
    return {
      installCommand: 'cargo build',
      startCommand: 'cargo run',
    }
  }

  if (stack.some((item) => item.name === 'Java') && files.includes('pom.xml')) {
    return {
      installCommand: 'mvn -q -DskipTests package',
      startCommand: 'mvn spring-boot:run || mvn exec:java',
    }
  }

  if (packageJson?.scripts?.dev) {
    return {
      installCommand: installWithManager,
      startCommand: runWithManager('dev'),
    }
  }

  if (packageJson?.scripts?.start) {
    return {
      installCommand: installWithManager,
      startCommand: packageManager === 'npm' ? 'npm start' : packageManager === 'pnpm' ? 'pnpm start' : packageManager === 'yarn' ? 'yarn start' : 'bun run start',
    }
  }

  if (packageJson?.scripts?.preview) {
    return {
      installCommand: installWithManager,
      startCommand: runWithManager('preview'),
    }
  }

  if (stack.some((item) => item.name === 'Vite')) {
    return {
      installCommand: installWithManager,
      startCommand: runWithManager('dev'),
    }
  }

  return {
    installCommand: installWithManager,
    startCommand: packageManager === 'npm' ? 'npm start' : packageManager === 'pnpm' ? 'pnpm start' : packageManager === 'yarn' ? 'yarn start' : 'bun run start',
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

function buildDetailedSummary(input: {
  repoUrl: string
  files: string[]
  stack: StackItem[]
  entryPoints: FileRef[]
  issues: RepoAnalysis['issues']
  testing: { coverage: number; testFiles: number }
  commitVelocity90d: number
}) {
  const fileCount = input.files.length
  const dirsCount = new Set(input.files.map((file) => dirname(file)).filter((dir) => dir !== '.')).size
  const keyExt = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs', '.md']
  const extBreakdown = keyExt
    .map((ext) => ({ ext, count: input.files.filter((file) => extname(file) === ext).length }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  return [
    `Repository: ${input.repoUrl}`,
    `Scanned ${fileCount} files across ${dirsCount} directories.`,
    `Detected stack signals: ${input.stack.map((item) => item.name).join(', ') || 'No strong stack signal detected'}.`,
    `Entry points: ${input.entryPoints.map((entry) => entry.path).slice(0, 8).join(', ') || 'No common entry point pattern matched'}.`,
    `Code quality snapshot: ${input.issues.security.length} security flags, ${input.issues.smells.length} smell indicators, ${input.issues.missingErrorHandling.length} potential missing error-handling spots.`,
    `Testing snapshot: ${input.testing.testFiles} test files detected, estimated coverage ${input.testing.coverage}%.`,
    `Activity snapshot: ${input.commitVelocity90d} commits in the last 90 days.`,
    `File type concentration: ${extBreakdown.map((item) => `${item.ext}(${item.count})`).join(', ') || 'N/A'}.`,
  ].join('\n')
}

function generateDocs(input: {
  repoUrl: string
  stack: StackItem[]
  entryPoints: FileRef[]
  logic: string[]
  runtime: { installCommand: string; startCommand: string }
  files: string[]
  issues: RepoAnalysis['issues']
  testing: { coverage: number; testFiles: number; untested: string[] }
}) {
  const topFolders = [...new Set(input.files.map((file) => file.split('/')[0]).filter((name) => name && !name.includes('.')))]
    .slice(0, 12)
  const stackLines = input.stack.length > 0 ? input.stack.map((s) => `- ${s.name}: ${s.evidence}`).join('\n') : '- No definitive stack markers found.'
  const entryLines = input.entryPoints.length > 0 ? input.entryPoints.map((e) => `- ${e.path}`).join('\n') : '- No standard entry points detected.'
  const readme = `# RepoLens Generated README\n\n## Source\n${input.repoUrl}\n\n## Project Behavior Snapshot\n${input.logic.map((l) => `- ${l}`).join('\n')}\n\n## Repository Footprint\n- Total files scanned: ${input.files.length}\n- Top folders: ${topFolders.join(', ') || 'N/A'}\n- Security findings: ${input.issues.security.length}\n- Code smells: ${input.issues.smells.length}\n- Estimated test coverage: ${input.testing.coverage}%\n\n## Runtime Commands\n- Install: \`${input.runtime.installCommand}\`\n- Start: \`${input.runtime.startCommand}\`\n\n## Entry Points\n${entryLines}`

  const apiOverview = `## API/Service Overview\n${stackLines}\n\n### Architecture Notes\n${input.logic.map((line) => `- ${line}`).join('\n')}`
  const onboarding = `## Onboarding Guide\n1. Read root docs and package/manifest files to confirm setup assumptions.\n2. Start execution tracing from ${input.entryPoints[0]?.path ?? 'the primary bootstrap file'}.\n3. Follow request/data flow through controllers, services, and persistence modules.\n4. Run tests using detected commands and inspect failures first.\n5. Prioritize hardcoded secret and error-handling hotspots before feature work.\n\n### Untested Candidate Files\n${input.testing.untested.slice(0, 20).map((file) => `- ${file}`).join('\n') || '- No obvious untested candidates found from heuristic scan.'}`

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
  const runtime = inferRuntimeCommands(stack, packageJson, files)
  const issues = findIssues(sampleContents)
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
  const docs = generateDocs({
    repoUrl,
    stack,
    entryPoints,
    logic,
    runtime,
    files,
    issues,
    testing,
  })
  const detailedSummary = buildDetailedSummary({
    repoUrl,
    files,
    stack,
    entryPoints,
    issues,
    testing,
    commitVelocity90d,
  })
  const glossary = buildGlossary(sampleContents)
  const hotspots = [...issues.hardcodedSecrets, ...issues.missingErrorHandling].slice(0, 15)
  const detectedTestCommands = detectTestCommands(packageJson, files)
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
      installCommand: runtime.installCommand,
      startCommand: runtime.startCommand,
      previewUrl: 'Will trigger when actual Run hit...',
      notes: [
        'Sandbox run executes cloned code locally. Run only trusted repositories.',
        'Preview URL is assigned dynamically when the run command is executed.',
      ],
    },
    explainIt: { summary: detailedSummary, stackBreakdown: stack, entryPoints, businessLogic: logic },
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
    testing: { detectedTestCommands, testFiles: testing.testFiles, untestedCandidateFiles: testing.untested },
    chatIndex: { hotspots, glossary },
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
