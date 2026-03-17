import cors from 'cors'
import express from 'express'
import { analyzeRepo, answerQuestion, compareAnalyses } from './repoAnalyzer.js'
import { startRepo } from './runRepo.js'
import type { ChatRequest, RepoAnalysis } from './types.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const analyses = new Map<string, RepoAnalysis>()

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'repolens-api' })
})

app.post('/api/run', async (req, res) => {
  const repoUrl = String(req.body?.repoUrl ?? '').trim()
  if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' })

  try {
    let analysis = analyses.get(repoUrl)
    if (!analysis) {
       const fresh = await analyzeRepo(repoUrl)
       analyses.set(repoUrl, fresh)
       analysis = fresh
    }

    const { url } = await startRepo((analysis as { _repoDir: string })._repoDir, analysis.runIt.detectedStack.map(n => ({name: n})))
    
    // Update the preview URL in memory 
    analysis.runIt.previewUrl = url;

    return res.json(analysis)
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to build/run repository sandbox.',
      detail: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/analyze', async (req, res) => {
  const repoUrl = String(req.body?.repoUrl ?? '').trim()
  if (!repoUrl) {
    return res.status(400).json({ error: 'repoUrl is required' })
  }

  try {
    const analysis = await analyzeRepo(repoUrl)
    analyses.set(repoUrl, analysis)
    return res.json(analysis)
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to analyze repository. Ensure URL is reachable and public.',
      detail: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.post('/api/chat', (req, res) => {
  const payload = req.body as ChatRequest
  const analysis = analyses.get(payload.analysisId)
  if (!analysis) {
    return res.status(404).json({ error: 'analysisId not found' })
  }

  const result = answerQuestion(analysis, payload.question)
  return res.json(result)
})

app.post('/api/compare', async (req, res) => {
  const leftUrl = String(req.body?.leftUrl ?? '').trim()
  const rightUrl = String(req.body?.rightUrl ?? '').trim()

  if (!leftUrl || !rightUrl) {
    return res.status(400).json({ error: 'leftUrl and rightUrl are required' })
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

app.post('/api/test-run', async (req, res) => {
  const repoUrl = String(req.body?.repoUrl ?? '').trim()
  if (!repoUrl) {
    return res.status(400).json({ error: 'repoUrl is required' })
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

const port = Number(process.env.PORT ?? 8787)
app.listen(port, () => {
  console.log(`RepoLens API listening on http://localhost:${port}`)
})
