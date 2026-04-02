import { Router } from 'express'
import { readdir, readFile } from 'node:fs/promises'
import { join, normalize, resolve, sep } from 'node:path'
import { enhanceAnalysisWithAI, answerQuestionWithAI } from './aiService.js'
import { analyzeRepo, answerQuestion, compareAnalyses } from './repoAnalyzer.js'
import { listRunningRepoSessions, startRepo, stopRepoRunByDir } from './runRepo.js'
import type { ChatRequest, CommandRequest, CommandResponse, RepoAnalysis } from './types.js'

function isHttpRepoUrl(value: string) {
  return /^https?:\/\//.test(value)
}

type PersistedAnalysis = RepoAnalysis & { _repoDir?: string }

async function collectFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const full = join(current, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') {
        continue
      }
      files.push(...(await collectFiles(root, full)))
      continue
    }

    if (entry.isFile()) {
      files.push(full.replace(`${root}${sep}`, '').replaceAll('\\', '/'))
    }
  }

  return files
}

function parseCommandInput(raw: string) {
  const parts = raw.match(/(?:"([^"]+)")|(?:'([^']+)')|(\S+)/g) ?? []
  const normalized = parts.map((part) => part.replace(/^['"]|['"]$/g, ''))
  const [command = '', ...args] = normalized
  return {
    raw,
    command: command.toLowerCase(),
    args,
  }
}

export function createApiRouter() {
  const router = Router()
  const analysesByRepo = new Map<string, PersistedAnalysis>()
  const analysesById = new Map<string, PersistedAnalysis>()

  const persistAnalysis = (analysis: PersistedAnalysis) => {
    analysesByRepo.set(analysis.repoUrl, analysis)
    analysesById.set(analysis.id, analysis)
    return analysis
  }

  const ensureAnalysis = async (repoUrl: string) => {
    const existing = analysesByRepo.get(repoUrl)
    if (existing) {
      return existing
    }

    const rawAnalysis = await analyzeRepo(repoUrl)
    const { analysis } = await enhanceAnalysisWithAI(rawAnalysis)
    const persisted = { ...analysis, _repoDir: rawAnalysis._repoDir }
    persistAnalysis(persisted)
    return persisted
  }

  router.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'repolens-api',
      runningSessions: listRunningRepoSessions().length,
      analysesCached: analysesById.size,
      timestamp: new Date().toISOString(),
    })
  })

  router.post('/analyze', async (req, res) => {
    const repoUrl = String(req.body?.repoUrl ?? '').trim()
    if (!repoUrl || !isHttpRepoUrl(repoUrl)) {
      return res.status(400).json({ error: 'Valid repoUrl is required' })
    }

    try {
      const analysis = await ensureAnalysis(repoUrl)
      return res.json(analysis)
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to analyze repository. Ensure URL is reachable and public.',
        detail: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  router.post('/run', async (req, res) => {
    const repoUrl = String(req.body?.repoUrl ?? '').trim()
    if (!repoUrl || !isHttpRepoUrl(repoUrl)) {
      return res.status(400).json({ error: 'Valid repoUrl is required' })
    }

    try {
      const analysis = await ensureAnalysis(repoUrl)
      if (!analysis._repoDir) {
        return res.status(500).json({ error: 'Repository runtime directory unavailable' })
      }

      const runResult = await startRepo({
        dir: analysis._repoDir,
        repoUrl,
        stack: analysis.explainIt.stackBreakdown,
        preferredInstallCommand: analysis.runIt.installCommand,
        preferredStartCommand: analysis.runIt.startCommand,
      })

      analysis.runIt.previewUrl = runResult.url
      analysis.runIt.notes = [
        ...analysis.runIt.notes.filter((line) => !line.startsWith('Runtime PID:')),
        `Runtime PID: ${runResult.pid ?? 'unknown'}`,
      ]

      persistAnalysis(analysis)
      return res.json(analysis)
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to build/run repository sandbox.',
        detail: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  router.post('/chat', async (req, res) => {
    const payload = req.body as ChatRequest
    if (!payload?.analysisId || !payload?.question?.trim()) {
      return res.status(400).json({ error: 'analysisId and question are required' })
    }

    const analysis = analysesById.get(payload.analysisId)
    if (!analysis) {
      return res.status(404).json({ error: 'analysisId not found' })
    }

    const response = await answerQuestionWithAI({
      analysis,
      question: payload.question,
      fallback: () => answerQuestion(analysis, payload.question),
    })

    return res.json(response)
  })

  router.post('/compare', async (req, res) => {
    const leftUrl = String(req.body?.leftUrl ?? '').trim()
    const rightUrl = String(req.body?.rightUrl ?? '').trim()

    if (!leftUrl || !rightUrl || !isHttpRepoUrl(leftUrl) || !isHttpRepoUrl(rightUrl)) {
      return res.status(400).json({ error: 'Valid leftUrl and rightUrl are required' })
    }

    try {
      const [left, right] = await Promise.all([ensureAnalysis(leftUrl), ensureAnalysis(rightUrl)])
      return res.json(compareAnalyses(left, right))
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to compare repositories',
        detail: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  router.post('/test-run', async (req, res) => {
    const repoUrl = String(req.body?.repoUrl ?? '').trim()
    if (!repoUrl || !isHttpRepoUrl(repoUrl)) {
      return res.status(400).json({ error: 'Valid repoUrl is required' })
    }

    try {
      const analysis = await ensureAnalysis(repoUrl)
      return res.json({
        detectedCommands: analysis.testing.detectedTestCommands,
        testFiles: analysis.testing.testFiles,
        suggestedMissingTests: analysis.testing.untestedCandidateFiles,
        summary: 'RepoLens estimated test surface and generated missing test targets.',
      })
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to inspect tests',
        detail: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  router.post('/explorer/tree', async (req, res) => {
    const repoUrl = String(req.body?.repoUrl ?? '').trim()
    if (!repoUrl || !isHttpRepoUrl(repoUrl)) {
      return res.status(400).json({ error: 'Valid repoUrl is required' })
    }

    try {
      const analysis = await ensureAnalysis(repoUrl)
      if (!analysis._repoDir) {
        return res.status(500).json({ error: 'Repository directory unavailable' })
      }

      const files = (await collectFiles(analysis._repoDir)).slice(0, 1200)
      return res.json({ analysisId: analysis.id, repoUrl: analysis.repoUrl, files })
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to load explorer tree',
        detail: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  router.post('/explorer/file', async (req, res) => {
    const analysisId = String(req.body?.analysisId ?? '').trim()
    const path = String(req.body?.path ?? '').trim()

    if (!analysisId || !path) {
      return res.status(400).json({ error: 'analysisId and path are required' })
    }

    const analysis = analysesById.get(analysisId)
    if (!analysis?._repoDir) {
      return res.status(404).json({ error: 'analysisId not found' })
    }

    const root = resolve(analysis._repoDir)
    const safeTarget = resolve(root, normalize(path))
    if (!safeTarget.startsWith(`${root}${sep}`) && safeTarget !== root) {
      return res.status(400).json({ error: 'Invalid file path' })
    }

    try {
      const content = await readFile(safeTarget, 'utf-8')
      return res.json({ path, content: content.slice(0, 150000) })
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to read file',
        detail: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  router.get('/runtime/sessions', (_req, res) => {
    return res.json({ sessions: listRunningRepoSessions() })
  })

  router.post('/runtime/stop', (req, res) => {
    const repoUrl = String(req.body?.repoUrl ?? '').trim()
    if (!repoUrl) {
      return res.status(400).json({ error: 'repoUrl is required' })
    }

    const analysis = analysesByRepo.get(repoUrl)
    if (!analysis?._repoDir) {
      return res.status(404).json({ error: 'No running runtime found for repoUrl' })
    }

    const stopped = stopRepoRunByDir(analysis._repoDir)
    return res.json({ stopped })
  })

  router.post('/command', async (req, res) => {
    const payload = req.body as CommandRequest & {
      repoUrl?: string
      leftUrl?: string
      rightUrl?: string
      analysisId?: string
    }

    const parsed = parseCommandInput(String(payload?.command ?? '').trim())
    if (!parsed.command) {
      return res.status(400).json({ error: 'command is required' })
    }

    const defaultRepo = String(payload?.repoUrl ?? '').trim()
    const logs: string[] = [`$ ${parsed.raw}`]

    try {
      const response: CommandResponse = {
        command: parsed.raw,
        capability: 'help',
        logs,
      }

      if (parsed.command === 'help') {
        logs.push('available commands: analyze <url>, structure, issues, stats, run, chat <question>, compare <repo1> <repo2>, open explorer, open analyzer')
        return res.json(response)
      }

      if (parsed.command === 'analyze') {
        const repoUrl = parsed.args[0] ?? defaultRepo
        if (!repoUrl || !isHttpRepoUrl(repoUrl)) {
          return res.status(400).json({ error: 'analyze requires a valid repo URL' })
        }

        logs.push('Cloning repository...')
        logs.push('Analyzing files...')
        const analysis = await ensureAnalysis(repoUrl)
        response.capability = 'analyze'
        response.result = { analysis }
        logs.push('Analysis complete.')
        return res.json(response)
      }

      if (parsed.command === 'structure' || parsed.command === 'issues' || parsed.command === 'stats' || parsed.command === 'docs') {
        const repoUrl = defaultRepo
        if (!repoUrl || !isHttpRepoUrl(repoUrl)) {
          return res.status(400).json({ error: `${parsed.command} requires repoUrl in body` })
        }

        const analysis = await ensureAnalysis(repoUrl)
        response.capability = parsed.command
        response.result = parsed.command === 'docs' ? { analysis, docs: analysis.docs } : { analysis }
        logs.push(`Rendered ${parsed.command} output.`)
        return res.json(response)
      }

      if (parsed.command === 'run') {
        const repoUrl = parsed.args[0] ?? defaultRepo
        if (!repoUrl || !isHttpRepoUrl(repoUrl)) {
          return res.status(400).json({ error: 'run requires a valid repo URL' })
        }

        const analysis = await ensureAnalysis(repoUrl)
        if (!analysis._repoDir) {
          return res.status(500).json({ error: 'Repository runtime directory unavailable' })
        }

        logs.push('Installing dependencies...')
        logs.push('Starting repository server...')
        const runResult = await startRepo({
          dir: analysis._repoDir,
          repoUrl,
          stack: analysis.explainIt.stackBreakdown,
          preferredInstallCommand: analysis.runIt.installCommand,
          preferredStartCommand: analysis.runIt.startCommand,
        })
        analysis.runIt.previewUrl = runResult.url
        response.capability = 'run'
        response.result = { analysis, run: runResult }
        logs.push(`Preview available at ${runResult.url}`)
        return res.json(response)
      }

      if (parsed.command === 'chat') {
        const question = parsed.args.join(' ').trim()
        const sourceById = payload.analysisId ? analysesById.get(payload.analysisId) : undefined
        const sourceByRepo = defaultRepo ? analysesByRepo.get(defaultRepo) : undefined
        const analysis = sourceById ?? sourceByRepo

        if (!question) {
          return res.status(400).json({ error: 'chat requires a question' })
        }

        if (!analysis) {
          return res.status(400).json({ error: 'chat requires analysisId or repoUrl that has already been analyzed' })
        }

        const chat = await answerQuestionWithAI({
          analysis,
          question,
          fallback: () => answerQuestion(analysis, question),
        })

        response.capability = 'chat'
        response.result = { chat }
        logs.push('Generated chat answer.')
        return res.json(response)
      }

      if (parsed.command === 'compare') {
        const leftUrl = parsed.args[0] ?? String(payload.leftUrl ?? '').trim()
        const rightUrl = parsed.args[1] ?? String(payload.rightUrl ?? '').trim()

        if (!leftUrl || !rightUrl || !isHttpRepoUrl(leftUrl) || !isHttpRepoUrl(rightUrl)) {
          return res.status(400).json({ error: 'compare requires two valid repo URLs' })
        }

        logs.push('Analyzing left repository...')
        logs.push('Analyzing right repository...')
        const [left, right] = await Promise.all([ensureAnalysis(leftUrl), ensureAnalysis(rightUrl)])
        const compare = compareAnalyses(left, right)
        response.capability = 'compare'
        response.result = { compare }
        logs.push('Comparison complete.')
        return res.json(response)
      }

      if (parsed.command === 'open') {
        const target = parsed.args.join(' ').toLowerCase()
        if (target === 'explorer' || target === 'analyzer') {
          response.capability = 'help'
          logs.push(`Opened ${target} window.`)
          return res.json(response)
        }
        return res.status(400).json({ error: 'open requires explorer or analyzer target' })
      }

      return res.status(400).json({ error: `Unsupported command '${parsed.command}'` })
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to execute command',
        detail: error instanceof Error ? error.message : 'Unknown error',
        logs,
      })
    }
  })

  return router
}
