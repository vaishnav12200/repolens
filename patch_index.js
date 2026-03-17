import fs from 'fs';
const code = fs.readFileSync('server/src/index.ts', 'utf8');

const updated = code.replace(
  /export \{ analyzeRepo, answerQuestion, compareAnalyses \}/,
  `export { analyzeRepo, answerQuestion, compareAnalyses };\nexport { startRepo } from './runRepo.js'`
).replace(
  /import \{ analyzeRepo, answerQuestion, compareAnalyses \} from '\.\/repoAnalyzer\.js'/,
  `import { analyzeRepo, answerQuestion, compareAnalyses } from './repoAnalyzer.js'\nimport { startRepo } from './runRepo.js'`
).replace(
  /app\.post\('\/api\/analyze', async \(req, res\) => \{/,
  `app.post('/api/run', async (req, res) => {
  const repoUrl = String(req.body?.repoUrl ?? '').trim()
  if (!repoUrl) return res.status(400).json({ error: 'repoUrl is required' })

  try {
    let analysis = analyses.get(repoUrl)
    if (!analysis) {
       const fresh = await analyzeRepo(repoUrl)
       analyses.set(repoUrl, fresh)
       analysis = fresh
    }

    const { url } = await startRepo((analysis as any)._repoDir, analysis.runIt.detectedStack.map(n => ({name: n})))
    
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

app.post('/api/analyze', async (req, res) => {`
).replace(
  /analyses\.set\(analysis\.id, analysis\)/,
  `analyses.set(repoUrl, analysis)`
);

fs.writeFileSync('server/src/index.ts', updated);
