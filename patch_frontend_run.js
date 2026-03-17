import fs from 'fs';
const code = fs.readFileSync('src/App.tsx', 'utf8');

const updated = code.replace(
  /const freshAnalysis \= await ensureAnalysis\(\)/,
  `
      if (selectedFeature.id === 'run') {
        const response = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl }),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error ?? 'Run execution failed')
        }
        setAnalysis(data)
        return
      }

      const freshAnalysis = await ensureAnalysis()
`
);

fs.writeFileSync('src/App.tsx', updated);
