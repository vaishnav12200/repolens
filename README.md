# RepoLens

RepoLens is a full-stack developer tool that analyzes any public repository URL and generates:

1. Run-it sandbox metadata
2. Plain English project explanation
3. Structure maps (folder, architecture, call/dependency graph)
4. Repo chat answers with file references
5. Issue scanning (security/smells/secrets)
6. Repo health dashboard and activity stats
7. Test surface insights
8. Side-by-side repo comparison
9. Generated documentation export
10. Learning mode with guided walkthrough

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript

## Run locally

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:8787

## Key endpoints

- `POST /api/analyze` — full repo analysis
- `POST /api/chat` — ask questions against a previous analysis
- `POST /api/test-run` — test coverage/test gap insight
- `POST /api/compare` — compare two repositories

## Notes

- Current implementation targets public Git repositories.
- Analysis is heuristic-based and intended as an MVP foundation.
