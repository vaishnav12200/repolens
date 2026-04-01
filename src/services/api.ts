import type { Analysis, ChatResponse, CompareResult, ExplorerFileResponse, ExplorerTreeResponse, TestResult } from '../types/repolens'

const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? ''
const apiBase = configuredBase.replace(/\/$/, '')

function apiUrl(path: string) {
  if (!apiBase) {
    return path
  }

  return `${apiBase}${path}`
}

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const payload = (await response.json()) as T | { error?: string; detail?: string }
  if (!response.ok) {
    const message = (payload as { error?: string; detail?: string }).detail || (payload as { error?: string }).error || 'Request failed'
    throw new Error(message)
  }

  return payload as T
}

export const api = {
  analyze: (repoUrl: string) => postJson<Analysis>(apiUrl('/api/analyze'), { repoUrl }),
  run: (repoUrl: string) => postJson<Analysis>(apiUrl('/api/run'), { repoUrl }),
  chat: (analysisId: string, question: string) => postJson<ChatResponse>(apiUrl('/api/chat'), { analysisId, question }),
  compare: (leftUrl: string, rightUrl: string) => postJson<CompareResult>(apiUrl('/api/compare'), { leftUrl, rightUrl }),
  testRun: (repoUrl: string) => postJson<TestResult>(apiUrl('/api/test-run'), { repoUrl }),
  explorerTree: (repoUrl: string) => postJson<ExplorerTreeResponse>(apiUrl('/api/explorer/tree'), { repoUrl }),
  explorerFile: (analysisId: string, path: string) => postJson<ExplorerFileResponse>(apiUrl('/api/explorer/file'), { analysisId, path }),
}
