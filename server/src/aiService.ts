import OpenAI from 'openai'
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

const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini'
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

function parseAiJson(raw: string | null | undefined): AiNarrative | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AiNarrative
    if (!parsed.summary || !Array.isArray(parsed.architectureExplanation) || !Array.isArray(parsed.learningSteps)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function enhanceAnalysisWithAI(analysis: RepoAnalysis) {
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
      model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a senior codebase analyst. Return strict JSON with keys: summary, architectureExplanation, learningSteps, glossary, readme, apiOverview, onboarding. Be detailed, factual, and grounded only in provided evidence. summary should be multi-line and comprehensive.',
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
  analysis: RepoAnalysis
  question: string
  fallback: () => { answer: string; references: Array<{ path: string; line?: number }> }
}) {
  const { analysis, question, fallback } = params

  if (!client) {
    return { ...fallback(), aiUsed: false as const }
  }

  try {
    const completion = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a repository engineering advisor, not a casual chatbot. Answer with concrete repo insights, architecture reasoning, and change-impact analysis. If asked "what if we change X", explain likely impact, affected areas, risks, and a safe rollout/testing approach. Return strict JSON with keys answer (string) and references (array of {path,line?}). Keep answers specific and evidence-grounded. If evidence is missing, say assumptions explicitly and avoid fabrication.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            question,
            repoUrl: analysis.repoUrl,
            summary: analysis.explainIt.summary,
            stack: analysis.explainIt.stackBreakdown,
            businessLogic: analysis.explainIt.businessLogic,
            entryPoints: analysis.explainIt.entryPoints,
            architecture: analysis.structure.architecture,
            topFiles: analysis.structure.folderTree.slice(0, 80),
            issues: analysis.issues,
            stats: analysis.stats,
            testing: analysis.testing,
            run: analysis.runIt,
          }),
        },
      ],
    })

    const raw = completion.choices[0]?.message?.content
    if (!raw) {
      return { ...fallback(), aiUsed: false as const }
    }

    const parsed = JSON.parse(raw) as {
      answer?: string
      references?: Array<{ path: string; line?: number }>
    }

    if (!parsed.answer) {
      return { ...fallback(), aiUsed: false as const }
    }

    return {
      answer: parsed.answer,
      references: parsed.references?.slice(0, 10) ?? [],
      aiUsed: true as const,
    }
  } catch {
    return { ...fallback(), aiUsed: false as const }
  }
}
