const fs = require('fs')

let text = fs.readFileSync('server/src/repoAnalyzer.ts', 'utf8')

text = text.replace(
  'const learning = generateLearningPath(files, sampleContents)',
  `const glossary = buildGlossary(sampleContents)
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
  }`
)

fs.writeFileSync('server/src/repoAnalyzer.ts', text)
console.log('patched')
