import fs from 'fs';
const code = fs.readFileSync('src/App.tsx', 'utf8');

const updated = code.replace(
  /function openFeatureWorkspace\(feature: Feature\) \{[\s\S]*?setTestResult\(null\)\s*\}/,
  `function openFeatureWorkspace(feature: Feature) {
    setSelectedFeature(feature)
    setScreen('workspace')
    setError('')
    setChatAnswer('')
    setChatRefs([])
    setCompareResult(null)
    setTestResult(null)
    // Always clear old analysis to force re-fetch when starting fresh or new URL is given
    if (analysis && analysis.repoUrl !== repoUrl) {
      setAnalysis(null);
    }
  }`
);

fs.writeFileSync('src/App.tsx', updated);
