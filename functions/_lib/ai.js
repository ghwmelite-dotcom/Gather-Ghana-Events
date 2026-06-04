// Provider-agnostic LLM helper (OpenAI-compatible Chat Completions).
// Works with OpenAI, Groq, OpenRouter, Together, etc. by setting AI_BASE_URL.
// Env-gated: returns null when unconfigured so callers fall back gracefully.

export const isConfigured = (env) => Boolean(env.AI_API_KEY)

export async function complete(env, { system, user, maxTokens = 700 }) {
  if (!isConfigured(env)) return null
  const base = (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = env.AI_MODEL || 'gpt-4o-mini'
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.8,
        messages: [
          system && { role: 'system', content: system },
          { role: 'user', content: user },
        ].filter(Boolean),
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch {
    return null
  }
}
