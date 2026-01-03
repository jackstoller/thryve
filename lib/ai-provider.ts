import { createOpenAI, openai } from "@ai-sdk/openai"

type ModelEntry = {
  id: string
  // We intentionally keep this loosely typed because the AI SDK model types vary
  // across providers and we want a small, dependency-light helper.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any
}

function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  return createOpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  })
}

export function getModelEntries(options: {
  openRouterModelIds: string[]
  fallbackOpenAIModelId: string
}): ModelEntry[] {
  const openrouter = getOpenRouterClient()
  if (openrouter) {
    // OpenRouter implements the OpenAI Chat Completions-style API. Using the
    // Responses API endpoint can fail (or be unsupported) depending on provider.
    return options.openRouterModelIds.map((id) => ({ id, model: openrouter.chat(id) }))
  }

  if (process.env.OPENAI_API_KEY) {
    return [
      {
        id: `openai/${options.fallbackOpenAIModelId}`,
        // Avoid the OpenAI Responses API model spec mismatch errors by forcing
        // the Chat model interface.
        model: openai.chat(options.fallbackOpenAIModelId),
      },
    ]
  }

  return []
}
