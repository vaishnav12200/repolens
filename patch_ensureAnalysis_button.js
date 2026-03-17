import fs from 'fs';
const code = fs.readFileSync('src/App.tsx', 'utf8');

const updatedCode = code.replace(
  /\{loading \? 'Running\.\.\.' \: \`Run \$\{selectedFeature.title\}\`\}/,
  `{loading ? 'Running...' : (analysis && selectedFeature.id !== 'compare' && selectedFeature.id !== 'test' && selectedFeature.id !== 'chat' && analysis.repoUrl === repoUrl) ? \`View \${selectedFeature.title}\` : \`Run \${selectedFeature.title}\`}`
);

fs.writeFileSync('src/App.tsx', updatedCode);
