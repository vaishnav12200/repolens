import fs from 'fs';
const code = fs.readFileSync('src/App.tsx', 'utf8');

const updated = code.replace(
  /<input value={repoUrl} onChange={\(event\) => setRepoUrl\(event.target.value\)} \/>/,
  `<input value={repoUrl} onChange={(event) => {
            setRepoUrl(event.target.value)
            setAnalysis(null)
          }} />`
);

fs.writeFileSync('src/App.tsx', updated);
