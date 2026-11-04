import type { Adapter, AdapterOpts, LLMResult, ProviderRow } from '../types'

/* ---------------- helpers ---------------- */

async function readError(res: Response): Promise<string> {
  let detail = ''
  try {
    const body = await res.clone().json()
    detail = body?.error?.message || body?.error || body?.message || JSON.stringify(body)
    if (typeof detail !== 'string') detail = JSON.stringify(detail)
  } catch {
    try {
      detail = await res.text()
    } catch {
      /* ignore */
    }
  }
  if (res.status === 401 || res.status === 403) detail = detail || 'Invalid or missing API key.'
  if (res.status === 429) detail = detail || 'Rate limit / quota exceeded. Free tiers reset per minute and per day.'
  return `${res.status}: ${detail.slice(0, 400) || res.statusText}`
}

const friendly = (e: unknown): Error => {
  if (e instanceof Error) {
    if (e.name === 'TypeError') return new Error('Network error — check the base URL, your connection, or the provider’s CORS policy.')
    return e
  }
  return new Error(String(e))
}

function labelOf(cfg: ProviderRow): string {
  return `${cfg.name} · ${cfg.model.replace(/^models\//, '')}`
}

/* ---------------- Google Gemini ---------------- */

interface GeminiPart {
  text?: string
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[]
  error?: { message?: string }
}

const gemini: Adapter = {
  async call(cfg, messages, opts: AdapterOpts = {}) {
    try {
      const base = cfg.base_url || 'https://generativelanguage.googleapis.com/v1beta'
      const model = cfg.model.replace(/^models\//, '')
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
      const user = messages.filter((m) => m.role !== 'system').map((m) => m.content).join('\n\n')
      const body = {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: [{ role: 'user', parts: [{ text: user || 'Hello' }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.3,
          maxOutputTokens: opts.maxTokens ?? 8192,
          ...(opts.json ? { responseMimeType: 'application/json' } : {}),
        },
      }
      const t0 = performance.now()
      const res = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.api_key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: opts.signal,
      })
      if (!res.ok) throw new Error(await readError(res))
      const data = (await res.json()) as GeminiResponse
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('') || ''
      if (!text.trim()) throw new Error('Empty response from Gemini (possibly blocked by safety filters).')
      return { text, label: labelOf(cfg), latency_ms: Math.round(performance.now() - t0) }
    } catch (e) {
      throw friendly(e)
    }
  },
}

/* ---------------- OpenAI-compatible (OpenAI, OpenRouter, Groq, Kimi, DeepSeek, Ollama…) ---------------- */

interface OAChoice {
  message?: { content?: string | null }
}
interface OpenAIResponse {
  choices?: OAChoice[]
  error?: { message?: string }
}

function openAICompatible(auth: boolean): Adapter {
  return {
    async call(cfg, messages, opts: AdapterOpts = {}) {
      const base = (cfg.base_url || 'https://api.openai.com/v1').replace(/\/+$/, '')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (auth && cfg.api_key) headers['Authorization'] = `Bearer ${cfg.api_key}`
      // OpenRouter etiquette
      if (base.includes('openrouter')) {
        headers['HTTP-Referer'] = location.origin
        headers['X-Title'] = 'JobPilot'
      }
      const callOnce = async () => {
        const t0 = performance.now()
        const body = {
          model: cfg.model,
          messages,
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens ?? 8192,
          ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
        }
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: opts.signal,
        })
        if (!res.ok) throw new Error(await readError(res))
        const data = (await res.json()) as OpenAIResponse
        const text = data.choices?.[0]?.message?.content ?? ''
        if (!text.trim()) throw new Error('Empty response from provider.')
        return { text, label: labelOf(cfg), latency_ms: Math.round(performance.now() - t0) } as LLMResult
      }
      try {
        return await callOnce()
      } catch (e) {
        // some gateways (notably Ollama's) reject response_format — retry once without it
        if (opts.json && e instanceof Error && /response_format|json_object|unknown field|format/i.test(e.message)) {
          try {
            return await callOnce()
          } catch (e2) {
            throw friendly(e2)
          }
        }
        throw friendly(e)
      }
    },
  }
}

/* ---------------- Anthropic Claude ---------------- */

interface AnthropicResponse {
  content?: { type: string; text?: string }[]
  error?: { message?: string }
}

const anthropic: Adapter = {
  async call(cfg, messages, opts: AdapterOpts = {}) {
    try {
      const base = (cfg.base_url || 'https://api.anthropic.com').replace(/\/+$/, '')
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
      const convo = messages
        .filter((m) => m.role !== 'system')
        .map((m) => m.content)
        .join('\n\n')
      const t0 = performance.now()
      const res = await fetch(`${base}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.api_key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: opts.maxTokens ?? 8192,
          temperature: opts.temperature ?? 0.3,
          ...(system ? { system } : {}),
          messages: [{ role: 'user', content: convo || 'Hello' }],
        }),
        signal: opts.signal,
      })
      if (!res.ok) throw new Error(await readError(res))
      const data = (await res.json()) as AnthropicResponse
      const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('') || ''
      if (!text.trim()) throw new Error('Empty response from Claude.')
      return { text, label: labelOf(cfg), latency_ms: Math.round(performance.now() - t0) }
    } catch (e) {
      throw friendly(e)
    }
  },
}

/* ---------------- registry ---------------- */

export const ADAPTERS: Record<ProviderRow['kind'], Adapter> = {
  gemini,
  openai_compatible: openAICompatible(true),
  anthropic,
  // Ollama needs no auth header and defaults to its local endpoint
  ollama: openAICompatible(false),
}

export function adapterFor(kind: ProviderRow['kind']): Adapter {
  return ADAPTERS[kind] ?? ADAPTERS.openai_compatible
}
