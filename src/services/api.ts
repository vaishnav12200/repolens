import type { Analysis, ChatResponse, CompareResult, ExplorerFileResponse, ExplorerTreeResponse, TestResult } from '../types/repolens'

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
  analyze: (repoUrl: string) => postJson<Analysis>('/api/analyze', { repoUrl }),
  run: (repoUrl: string) => postJson<Analysis>('/api/run', { repoUrl }),
  chat: (analysisId: string, question: string) => postJson<ChatResponse>('/api/chat', { analysisId, question }),
  compare: (leftUrl: string, rightUrl: string) => postJson<CompareResult>('/api/compare', { leftUrl, rightUrl }),
  testRun: (repoUrl: string) => postJson<TestResult>('/api/test-run', { repoUrl }),
  explorerTree: (repoUrl: string) => postJson<ExplorerTreeResponse>('/api/explorer/tree', { repoUrl }),
  explorerFile: (analysisId: string, path: string) => postJson<ExplorerFileResponse>('/api/explorer/file', { analysisId, path }),
}
