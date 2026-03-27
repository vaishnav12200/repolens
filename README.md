<div align="center">

# RepoLens

AI-native repo intelligence: analyze any public Git repository, spin up a runnable sandbox, and surface plain-English insights, structure maps, risks, documentation, and side-by-side comparisons.

</div>

## What it does

- Analyze any public repo URL and detect stack, entry points, and runtime playbooks.
- Generate architecture slices (folder tree, dependency graph, call graph, heuristics for frontend/backend layers).
- Surface issues: security smells, hardcoded secrets, missing error handling, outdated dependencies, TODO/FIXME markers.
- Estimate repo health: commit velocity (90d), most-changed files, bus factor, code age heatmap, test surface coverage.
- Provide repo chat answers with file references, guided learning steps, glossary, and auto-generated README/API/onboarding docs.
- Compare two repositories with a heuristic recommendation.
- Optional “Run” flow starts the repo in a local sandbox and returns a preview URL.

## Architecture

- Frontend: React 19 + TypeScript + Vite (SPA UI for selecting capabilities and viewing results).
- Backend: Node.js + Express + TypeScript.
- Analysis engine: clones the target repo (shallow), walks files, samples contents, and builds heuristics for stack, entry points, structure, and risks. Uses git history locally for stats.
- Sandbox runner: installs dependencies and attempts to start the repo on an ephemeral port based on detected stack hints (Node/Vite/Python heuristics).

## Prerequisites

- Node.js 20+ (for native ESM, `tsx`, and Vite 8).
- Git installed and reachable on PATH (for cloning and git stats).

## Getting started

```bash
git clone https://github.com/<you>/repolens
cd repolens
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:8787

### Useful scripts

- `npm run dev` — run frontend (Vite) and backend (Express) together via `concurrently`.
- `npm run dev:client` — frontend only.
- `npm run dev:server` — backend only with `tsx` watch.
- `npm run build` — type-check then build client bundle.
- `npm run build:client` — build client bundle only.
- `npm run start` — start API in production mode (no Vite dev server).
- `npm run lint` — run ESLint on the repo.

## API reference (MVP)

Base URL: `http://localhost:8787`

| Endpoint | Method | Body | Notes |
| --- | --- | --- | --- |
| `/api/health` | GET | — | Simple health probe. |
| `/api/analyze` | POST | `{ repoUrl: string }` | Full analysis; clones repo, computes stats, returns `analysis.id` used by chat. |
| `/api/run` | POST | `{ repoUrl: string }` | Reuses/creates analysis, installs deps, attempts to start repo on an ephemeral port; returns `runIt.previewUrl`. |
| `/api/chat` | POST | `{ analysisId: string, question: string }` | Answers questions against an existing analysis. |
| `/api/compare` | POST | `{ leftUrl: string, rightUrl: string }` | Analyzes both repos and returns heuristic comparison. |
| `/api/test-run` | POST | `{ repoUrl: string }` | Returns detected test commands, test file counts, and suggested untested files. |

### Response sketch (analyze)

```json
{
	"id": "uuid",
	"repoUrl": "https://github.com/expressjs/express",
	"runIt": { "detectedStack": ["Node.js", "Vite"], "installCommand": "npm install", "startCommand": "npm run dev", "previewUrl": "..." },
	"explainIt": { "summary": "...", "stackBreakdown": [...], "entryPoints": [{"path": "src/main.tsx"}], "businessLogic": [...] },
	"structure": { "folderTree": [...], "architecture": [...], "callGraph": [...], "dependencyGraph": [...] },
	"issues": { "security": [...], "outdated": [...], "smells": [...], "missingErrorHandling": [...], "hardcodedSecrets": [...] },
	"stats": { "mostChangedFiles": [...], "busFactorByFolder": [...], "codeAgeHeatmap": [...], "commitVelocity90d": 0, "testCoverageEstimate": 0 },
	"testing": { "detectedTestCommands": ["npm test"], "testFiles": 0, "untestedCandidateFiles": [...] },
	"docs": { "readme": "...", "apiOverview": "...", "onboarding": "..." },
	"learning": { "tutorialSteps": [...], "importantFiles": [...], "glossary": [...] }
}
```

## Frontend usage

1. Open the app at http://localhost:5173.
2. Pick a capability (Run, Explain, Structure, Chat, Issues, Stats, Test, Compare, Docs, Learn) from the landing or selector screen.
3. Enter a public Git repo URL (and an optional second URL for Compare) then click the CTA to trigger the corresponding API call.
4. For Docs, use the download button to export the generated README/API/onboarding bundle.

## Folder layout

- [src](src) — React SPA (screens for landing, selector, workspace; feature result rendering).
- [server/src](server/src) — Express API, repo analyzer, sandbox runner, shared types.
- [public](public) — static assets served by Vite.

Key back-end modules:

- [server/src/index.ts](server/src/index.ts) — API routes and in-memory analysis cache.
- [server/src/repoAnalyzer.ts](server/src/repoAnalyzer.ts) — clone repo, detect stack/entry points, build structure graphs, derive issues and stats, generate docs and learning aids.
- [server/src/runRepo.ts](server/src/runRepo.ts) — install deps and start the analyzed repo on an ephemeral port based on stack hints.
- [server/src/types.ts](server/src/types.ts) — shared type contracts for API payloads and analysis results.

## Behavior notes and limitations

- Public Git repos only; private repos will fail to clone.
- Clones happen in a temporary directory (shallow, depth 1) and are reused in-memory per repo during the process lifetime; long-running processes may accumulate temp dirs.
- Stack detection and issue finding are heuristic and intentionally conservative; results are best-effort, not a security audit.
- Sandbox runner executes the target repo’s install/start commands locally; inspect output and run in a safe environment before using on untrusted code.

## Roadmap ideas

- Persist analyses and chat indexes beyond process lifetime.
- Harden sandboxing (containerize runs) and add resource/time quotas.
- Add SCM integrations for authenticated/private repos and pull requests.
- Expand language/framework detectors and test runners.
- Export richer docs (architecture diagrams, threat model summaries).

## License

License to be added. Until then, treat as all rights reserved.
