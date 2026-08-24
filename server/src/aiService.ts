import Groq from 'groq-sdk'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import type { RepoAnalysis } from './types.js'

type AiNarrative = {
  summary: string
  architectureExplanation: string[]
  learningSteps: string[]
  glossary: Array<{ term: string; meaning: string }>
  readme: string
  apiOverview: string
  onboarding: string
}

const DEFAULT_MODEL = 'openai/gpt-oss-120b'
const DEPRECATED_MODELS: Record<string, string> = {
  'llama-3.3-70b-versatile': DEFAULT_MODEL,
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
}

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.py', '.go', '.rs', '.java', '.rb', '.php', '.cs', '.yml', '.yaml', '.sql', '.html', '.css', '.scss',
])

type AnalysisWithRepoDir = RepoAnalysis & { _repoDir?: string }

function getModel() {
  const configured = process.env.GROQ_MODEL?.trim()
  return DEPRECATED_MODELS[configured ?? ''] ?? configured ?? DEFAULT_MODEL
}

export function getAiStatus() {
  const configuredModel = process.env.GROQ_MODEL?.trim()
  return {
    configured: Boolean(process.env.GROQ_API_KEY?.trim()),
    model: getModel(),
    migratedFromDeprecatedModel: configuredModel && DEPRECATED_MODELS[configuredModel] ? configuredModel : undefined,
  }
}

function getClient() {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) return null
  return new Groq({ apiKey })
}

function questionTokens(question: string) {
  return new Set(
    question
      .toLowerCase()
      .split(/[^a-z0-9_/-]+/)
      .filter((token) => token.length > 2),
  )
}

function scoreFile(path: string, tokens: Set<string>, entryPoints: string[]) {
  const lower = path.toLowerCase()
  let score = entryPoints.includes(path) ? 8 : 0
  if (/^(readme|package\.json|dockerfile|compose|vite\.config|next\.config|tsconfig)/i.test(path)) score += 4
  for (const token of tokens) {
    if (lower.includes(token)) score += 5
  }
  if (/\/(service|controller|route|api|auth|store|component|model|handler)/i.test(path)) score += 1
  return score
}

async function buildRepositoryContext(analysis: AnalysisWithRepoDir, question: string) {
  if (!analysis._repoDir) return []

  const root = resolve(analysis._repoDir)
  const tokens = questionTokens(question)
  const entryPoints = analysis.explainIt.entryPoints.map((item) => item.path)
  const selected = analysis.structure.folderTree
    .filter((path) => SOURCE_EXTENSIONS.has(extname(path).toLowerCase()) || /(^|\/)README(?:\.[^.]+)?$/i.test(path) || /(^|\/)Dockerfile$/i.test(path))
    .sort((left, right) => scoreFile(right, tokens, entryPoints) - scoreFile(left, tokens, entryPoints) || left.localeCompare(right))
    .slice(0, 8)

  const files = await Promise.all(
    selected.map(async (path) => {
      const absolutePath = resolve(root, path)
      if (!absolutePath.startsWith(`${root}${sep}`)) return null

      try {
        const content = await readFile(join(root, path), 'utf-8')
        return { path, content: content.slice(0, 6000) }
      } catch {
        return null
      }
    }),
  )

  return files.filter((file): file is { path: string; content: string } => Boolean(file))
}

function parseAiJson(raw: string | null | undefined): AiNarrative | null {
  if (!raw) return null

  const candidates = [raw.trim()]

  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim())
  }

  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1).trim())
  }

  try {
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as AiNarrative
        if (!parsed.summary || !Array.isArray(parsed.architectureExplanation) || !Array.isArray(parsed.learningSteps)) {
          continue
        }
        return parsed
      } catch {
        continue
      }
    }
  } catch {
    return null
  }

  return null
}

export async function enhanceAnalysisWithAI(analysis: RepoAnalysis) {
  const client = getClient()
  if (!client) {
    return { analysis, aiUsed: false as const }
  }

  const prompt = {
    repoUrl: analysis.repoUrl,
    stack: analysis.runIt.detectedStack,
    entryPoints: analysis.explainIt.entryPoints,
    architecture: analysis.structure.architecture,
    issues: analysis.issues,
    stats: analysis.stats,
  }

  try {
    const completion = await client.chat.completions.create({
      model: getModel(),
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a senior codebase analyst. Return strict JSON with keys: summary, architectureExplanation, learningSteps, glossary, readme, apiOverview, onboarding. Be detailed, factual, and grounded only in provided evidence. summary should be multi-line and comprehensive. Do not wrap the JSON in markdown fences or extra prose.',
        },
        {
          role: 'user',
          content: `Generate enhanced RepoLens analysis narratives from this JSON. Keep all claims evidence-grounded and avoid generic filler: ${JSON.stringify(prompt)}`,
        },
      ],
    })

    const aiResult = parseAiJson(completion.choices[0]?.message?.content)
    if (!aiResult) {
      return { analysis, aiUsed: false as const }
    }

    const merged: RepoAnalysis = {
      ...analysis,
      explainIt: {
        ...analysis.explainIt,
        summary: aiResult.summary,
      },
      structure: {
        ...analysis.structure,
        architecture: aiResult.architectureExplanation,
      },
      docs: {
        readme: aiResult.readme,
        apiOverview: aiResult.apiOverview,
        onboarding: aiResult.onboarding,
      },
      learning: {
        ...analysis.learning,
        tutorialSteps: aiResult.learningSteps,
        glossary: aiResult.glossary,
      },
      chatIndex: {
        ...analysis.chatIndex,
        glossary: aiResult.glossary,
      },
    }

    return { analysis: merged, aiUsed: true as const }
  } catch {
    return { analysis, aiUsed: false as const }
  }
}

export async function answerQuestionWithAI(params: {
  analysis: AnalysisWithRepoDir
  question: string
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
  fallback: () => { answer: string; references: Array<{ path: string; line?: number }> }
}) {
  const { analysis, question, history = [], fallback } = params

  const client = getClient()
  if (!client) {
    return { ...fallback(), aiUsed: false as const }
  }

  try {
    const sourceFiles = await buildRepositoryContext(analysis, question)
    const completion = await client.chat.completions.create({
      model: getModel(),
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful AI assistant with access to a repository snapshot. Answer ordinary questions naturally and clearly. When the question is about the repository, base the answer only on the supplied repository facts and source excerpts. Explain uncertainty rather than inventing behavior. For change-impact questions, cover affected areas, risks, and a safe validation plan. Return valid JSON only: {"answer": string, "references": [{"path": string, "line": number?}]}. References must name only supplied source files and should be omitted for general questions.',
        },
        ...history
          .filter((message) => (message.role === 'user' || message.role === 'assistant') && Boolean(message.text?.trim()))
          .slice(-12)
          .map((message) => ({ role: message.role, content: message.text.slice(0, 2000) })),
        {
          role: 'user',
          content: JSON.stringify({
            question,
            repository: {
              repoUrl: analysis.repoUrl,
              summary: analysis.explainIt.summary,
              stack: analysis.explainIt.stackBreakdown,
              businessLogic: analysis.explainIt.businessLogic,
              entryPoints: analysis.explainIt.entryPoints,
              architecture: analysis.structure.architecture,
              topFiles: analysis.structure.folderTree.slice(0, 120),
              issues: analysis.issues,
              stats: analysis.stats,
              testing: analysis.testing,
              run: analysis.runIt,
              sourceFiles,
            },
          }),
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) {
      return { ...fallback(), aiUsed: false as const }
    }

    try {
      const parsed = JSON.parse(raw) as {
        answer?: string
        references?: Array<{ path: string; line?: number }>
      }

      if (parsed.answer?.trim()) {
        const allowedReferences = new Set(sourceFiles.map((file) => file.path))
        return {
          answer: parsed.answer,
          references: (parsed.references ?? []).filter((reference) => allowedReferences.has(reference.path)).slice(0, 10),
          aiUsed: true as const,
        }
      }
    } catch {
      // Fall through to plain-text handling.
    }

    const plainAnswer = raw.trim()
    if (!plainAnswer) {
      return { ...fallback(), aiUsed: false as const }
    }

    return {
      answer: plainAnswer,
      references: analysis.explainIt.entryPoints.slice(0, 6),
      aiUsed: true as const,
    }
  } catch {
    return { ...fallback(), aiUsed: false as const }
  }
}
