import { Router } from 'express'
import { enhanceAnalysisWithAI, answerQuestionWithAI } from './aiService.js'
import { analyzeRepo, answerQuestion, compareAnalyses } from './repoAnalyzer.js'
import { startRepo } from './runRepo.js'
import type { ChatRequest, RepoAnalysis } from './types.js'

function isHttpRepoUrl(value: string) {
  return /^https?:\/\//.test(value)
}

export function createApiRouter() {
  const router = Router()
  const analysesByRepo = new Map<string, RepoAnalysis & { _repoDir?: string }>()
  const analysesById = new Map<string, RepoAnalysis & { _repoDir?: string }>()

  router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'repolens-api' })
  })

  router.post('/analyze', async (req, res) => {
    const repoUrl = String(req.body?.repoUrl ?? '').trim()
    if (!repoUrl || !isHttpRepoUrl(repoUrl)) {
      return res.status(400).json({ error: 'Valid repoUrl is required' })
    }

    try {
      const rawAnalysis = await analyzeRepo(repoUrl)
      const { analysis, aiUsed } = await enhanceAnalysisWithAI(rawAnalysis)

      const persisted = { ...analysis, _repoDir: rawAnalysis._repoDir }
      analysesByRepo.set(repoUrl, persisted)
      analysesById.set(analysis.id, persisted)

      return res.json({ ...analysis, meta: { aiUsed } })
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
      let analysis = analysesByRepo.get(repoUrl)
      if (!analysis) {
        const rawAnalysis = await analyzeRepo(repoUrl)
        const enhanced = await enhanceAnalysisWithAI(rawAnalysis)
        analysis = { ...enhanced.analysis, _repoDir: rawAnalysis._repoDir }
        analysesByRepo.set(repoUrl, analysis)
        analysesById.set(analysis.id, analysis)
      }

      if (!analysis._repoDir) {
        return res.status(500).json({ error: 'Repository runtime directory unavailable' })
      }

      const { url } = await startRepo(
        analysis._repoDir,
        analysis.runIt.detectedStack.map((name) => ({
          name,
          confidence: 'medium' as const,
          evidence: 'Derived from detected stack names',
        })),
      )

      analysis.runIt.previewUrl = url
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
      const [left, right] = await Promise.all([analyzeRepo(leftUrl), analyzeRepo(rightUrl)])
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
      const analysis = await analyzeRepo(repoUrl)
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

  return router
}
