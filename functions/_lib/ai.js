// LLM helper. Prefers Cloudflare Workers AI (free, no external key) via the AI
// binding; falls back to any OpenAI-compatible API if AI_API_KEY is set; else
// returns null so callers degrade gracefully.

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

export const isConfigured = (env) => Boolean(env.AI || env.AI_API_KEY)

export async function complete(env, { system, user, maxTokens = 700 }) {
  const messages = [system && { role: 'system', content: system }, { role: 'user', content: user }].filter(Boolean)

  // 1) Cloudflare Workers AI (binding) — the default, no key required.
  if (env.AI) {
    try {
      const model = env.WORKERS_AI_MODEL || DEFAULT_MODEL
      const r = await env.AI.run(model, { messages, max_tokens: maxTokens, temperature: 0.8 })
      const text = (r?.response || '').trim()
      if (text) return text
    } catch {
      /* fall through to external / null */
    }
  }

  // 2) External OpenAI-compatible API (optional).
  if (env.AI_API_KEY) {
    const base = (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
    const model = env.AI_MODEL || 'gpt-4o-mini'
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.8, messages }),
      })
      if (res.ok) {
        const data = await res.json()
        return data.choices?.[0]?.message?.content?.trim() || null
      }
    } catch {
      /* ignore */
    }
  }

  return null
}
