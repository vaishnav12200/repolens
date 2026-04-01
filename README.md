# RepoLens OS

RepoLens OS is a web-based, terminal-first developer operating system that runs in the browser.

Instead of a traditional webpage, RepoLens OS provides a Linux-inspired desktop with draggable windows, dock-based app launching, and a command-line workflow for repository analysis, AI-assisted Q&A, sandboxed runtime previews, and code exploration.

---

## Highlights

- Fullscreen desktop environment with top bar, status indicators, and glassmorphism windows.
- Window manager with drag, resize, minimize, maximize, and focus stacking.
- Bottom dock launcher for Terminal, Analyzer, Chat, and Settings.
- Terminal-first UX with command history, tab auto-complete, blinking cursor, and streamed output.
- Repo Analyzer app for summary, stack, entry points, issues, stats, and score.
- File Explorer app with syntax-highlighted file preview (Shiki).
- AI Chat app integrated with repository analysis context.
- Node.js + Express backend that clones repos, computes heuristics, and exposes APIs.

---

## Tech Stack

### Frontend

- React 19 + TypeScript + Vite
- Zustand (OS state and window/session state)
- Framer Motion (window/dock animations)
- Tailwind CSS + custom OS-themed CSS
- Shiki (syntax highlighting in explorer editor)

### Backend

- Node.js + Express + TypeScript
- Git shallow cloning (`--depth 1`) for analysis inputs
- Heuristic analyzer for stack, structure, issues, and repo health metrics
- Optional OpenAI augmentation for richer summary/chat output

---

## Core UX Model

RepoLens OS behaves like a browser OS shell:

1. Boot into desktop with terminal open by default.
2. Run commands from terminal (primary interaction path).
3. Open apps/windows with command (`open explorer`) or dock click.
4. Keep session state in-memory + local persistence for command/history cache.

---

## Terminal Commands

Supported command set:

- `help`
- `clear`
- `analyze <repo_url>`
- `run`
- `issues`
- `stats`
- `structure`
- `chat <question>`
- `compare <repo1> <repo2>`
- `open explorer`
- `open analyzer`

Notes:

- `analyze` populates analyzer context and cache.
- `run` starts a sandbox preview from analyzed repository info.
- `chat` uses current analysis context; if missing, analysis is triggered first.
- `open explorer` loads file tree and enables click-to-open file preview.

---

## Prerequisites

- Node.js 20+
- npm 10+
- Git available on PATH

Optional environment variables:

- `OPENAI_API_KEY` — enables AI-enhanced summary/chat responses.
- `OPENAI_MODEL` — defaults to `gpt-4.1-mini`.
- `PORT` — backend API port (default `8787`).

---

## Getting Started

```bash
git clone <your-repolens-repo-url>
cd repolens
npm install
npm run dev
```

Runtime endpoints:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8787`

## Deploy to Firebase (Existing Project)

This setup deploys:

- Frontend (Vite `dist/`) to Firebase Hosting
- Backend API (`/api/**`) to Cloud Run service `repolens-api` via Hosting rewrite

### 1) One-time CLI setup

```bash
npm install -g firebase-tools
curl -sSL https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud auth login
firebase login
```

### 2) Point to your existing Firebase project

Update `.firebaserc` default project id or run:

```bash
firebase use <your-existing-project-id>
```

### 3) Deploy backend API to Cloud Run

```bash
npm run deploy:api
```

Set API runtime secrets/env (including OpenAI key):

```bash
gcloud run services update repolens-api \
	--region us-central1 \
	--set-env-vars OPENAI_API_KEY=<your_openai_key>,OPENAI_MODEL=gpt-4.1-mini
```

### 4) Deploy frontend Hosting

```bash
npm run deploy:hosting
```

### 5) Attach custom domain `repolenswebos.com`

```bash
firebase deploy --only hosting
```

Then in Firebase Console → Hosting → Custom domains:

- Add `repolenswebos.com`
- Add `www.repolenswebos.com` (optional)
- Copy the DNS records shown by Firebase into your domain registrar

After DNS verification + SSL provisioning, your app will be live on the custom domain.

### Scripts

- `npm run dev` — runs frontend + backend together.
- `npm run dev:client` — frontend only.
- `npm run dev:server` — backend only (watch mode).
- `npm run build` — type-check + production build.
- `npm run build:client` — client build only.
- `npm run start` — backend production start.
- `npm run deploy:api` — deploy API container to Cloud Run.
- `npm run deploy:hosting` — build + deploy frontend to Firebase Hosting.
- `npm run deploy:all` — deploy API then Hosting.
- `npm run lint` — ESLint.

---

## API Reference

Base URL: `http://localhost:8787`

| Endpoint | Method | Request Body | Purpose |
| --- | --- | --- | --- |
| `/api/health` | GET | — | Health/status probe. |
| `/api/analyze` | POST | `{ repoUrl: string }` | Analyze repository and cache analysis object. |
| `/api/run` | POST | `{ repoUrl: string }` | Install + start analyzed repo, return preview URL. |
| `/api/chat` | POST | `{ analysisId: string, question: string }` | Ask repository-aware question. |
| `/api/compare` | POST | `{ leftUrl: string, rightUrl: string }` | Compare two repositories and return recommendation. |
| `/api/test-run` | POST | `{ repoUrl: string }` | Detect test commands + estimated test surface. |
| `/api/explorer/tree` | POST | `{ repoUrl: string }` | Return traversed file tree list for explorer. |
| `/api/explorer/file` | POST | `{ analysisId: string, path: string }` | Return file content for explorer editor preview. |
| `/api/runtime/sessions` | GET | — | List active sandbox runtime sessions. |
| `/api/runtime/stop` | POST | `{ repoUrl: string }` | Stop active runtime for repo. |
| `/api/command` | POST | `{ command: string, repoUrl?: string, leftUrl?: string, rightUrl?: string, analysisId?: string }` | Backend command parser/dispatcher endpoint. |

---

## Project Structure

```text
src/
	App.tsx
	os/
		Desktop.tsx
		Dock.tsx
		WindowManager.tsx
		useOsStore.ts
		types.ts
	apps/
		TerminalApp.tsx
		ExplorerApp.tsx
		ChatApp.tsx
		AnalyzerApp.tsx
		SettingsApp.tsx
	services/
		api.ts
	types/
		repolens.ts

server/src/
	index.ts
	routes.ts
	repoAnalyzer.ts
	runRepo.ts
	aiService.ts
	types.ts
```

---

## How Analysis Works

1. Clone target repo to temp directory (`git clone --depth 1`).
2. Walk files excluding noisy directories (`.git`, `node_modules`, build outputs, etc.).
3. Sample text files and detect:
	 - stack/framework hints,
	 - entry points,
	 - architecture cues,
	 - issues and code smells,
	 - statistics and repo score.
4. Optionally enrich summary and chat responses using OpenAI.
5. Cache analysis in memory for low-latency follow-up commands.

---

## Sandbox Runner Behavior

The runtime system attempts to infer install/start commands from stack + repo files:

- Installs deps (`npm`, `yarn`, `pnpm`, or `pip`) where applicable.
- Allocates a free random local port.
- Starts app process with host/port environment settings.
- Polls preview URL until reachable.

Use caution when running untrusted repositories; execution happens locally.

---

## Explorer Security Notes

- Explorer file reads are bound to analyzed repo root.
- Path normalization + root-prefix validation is applied to prevent path traversal.
- File content is truncated to a capped size before response.

---

## Limitations

- Public repositories only (private repo auth is not implemented yet).
- In-memory cache only (analysis/session data resets on backend restart).
- Heuristic analysis is best-effort and not a substitute for a formal audit.
- Shiki language/theme bundles can increase production bundle size.

---

## Troubleshooting

### `analyze` fails

- Verify repo URL is public and reachable.
- Ensure Git is installed and available in PATH.

### `run` fails

- Target repo may require unsupported runtime dependencies.
- Check backend logs for install/start command failure output.

### Chat is generic

- Provide `OPENAI_API_KEY` for stronger AI responses.
- Without API key, fallback heuristic responder is used.

---

## Security Considerations

- Do not run unknown repositories on sensitive machines.
- Consider containerizing sandbox execution for stricter isolation.
- Add resource/time limits for production hardening.

---

## Roadmap

- Persistent analysis store (database-backed cache).
- Containerized sandbox runtime with quotas.
- Better window manager polish (snapping, dock minimize indicators).
- Private repo support (token/auth integration).
- Richer graph visualizations inside Analyzer app.

---

## License

License not yet specified. Treat as all rights reserved until a license file is added.
