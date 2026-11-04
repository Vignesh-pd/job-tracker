import type { ZodType } from 'zod'
import { adapterFor } from './adapters'
import { AIError, type ChatMessage, type LLMResult, type ProviderRow } from '../types'

/* ---------------- connection test ---------------- */

export async function testConnection(cfg: ProviderRow): Promise<{ ok: boolean; latency_ms?: number; error?: string }> {
  try {
    const r = await adapterFor(cfg.kind).call(
      cfg,
      [{ role: 'user', content: 'Reply with exactly: OK' }],
      { temperature: 0, maxTokens: 16 },
    )
    return { ok: true, latency_ms: r.latency_ms }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/* ---------------- raw text ---------------- */

export async function generateText(
  task: string,
  cfg: ProviderRow,
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<LLMResult> {
  let lastErr: Error | unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await adapterFor(cfg.kind).call(cfg, messages, { temperature: opts?.temperature ?? 0.4, maxTokens: opts?.maxTokens })
    } catch (e) {
      lastErr = e
      const err = e as Error & { status?: number; name?: string }
      const status = err.status ?? resStatus(err.message)
      const retryable = status === 429 || status === 503 || status === 529 || status === undefined // network flake
      if (retryable && attempt < 2) {
        await wait(1000 * 2 ** attempt)
        continue
      }
      break
    }
  }
  const err = lastErr as Error & { status?: number }
  console.error(`[ai:${task}]`, err)
  throw err instanceof AIError ? err : new AIError(err?.message ?? 'AI call failed')
}

/* ---------------- validated JSON ---------------- */

/** pulls the first JSON object/array out of a possibly-chatty completion */
export function extractJson(text: string): string {
  let s = text.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const first = Math.min(...['{', '['].map((c) => (s.indexOf(c) === -1 ? Infinity : s.indexOf(c))))
  if (first !== Infinity) {
    const openChar = s[first]
    const closeChar = openChar === '{' ? '}' : ']'
    const last = s.lastIndexOf(closeChar)
    if (last > first) s = s.slice(first, last + 1)
  }
  return s
}

/** best-effort repair: trim trailing commas */
function looseParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1'))
  }
}

export async function generateJson<T>(
  task: string,
  cfg: ProviderRow,
  system: string,
  user: string,
  schema: ZodType<T>,
  opts?: { temperature?: number; maxTokens?: number },
): Promise<{ data: T; label: string }> {
  const sys = `${system}\n\nIMPORTANT: respond with ONLY a valid JSON object. No markdown fences, no prose, no explanations.`
  const messages: ChatMessage[] = [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ]

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: LLMResult
    try {
      res = await generateText(
        task,
        cfg,
        attempt === 0
          ? messages
          : [...messages, { role: 'user', content: 'Your previous reply was not valid JSON. Re-run. Output ONLY the JSON object, nothing else.' }],
        opts,
      )
    } catch (e) {
      throw e
    }
    try {
      const parsed = schema.safeParse(looseParse(extractJson(res.text)))
      if (parsed.success) return { data: parsed.data, label: res.label }
      const issue = parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ')
      console.warn(`[ai:${task}] schema issues (attempt ${attempt + 1}):`, issue)
    } catch (e) {
      console.warn(`[ai:${task}] parse fail (attempt ${attempt + 1})`, e)
    }
  }
  throw new AIError(`${cfg.name} returned invalid JSON twice for the ${task} task. Try a different model or reduce the input size.`)
}

/* ---------------- small helpers ---------------- */

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function resStatus(msg: string): number | undefined {
  const m = msg.match(/^(\d{3}):/)
  return m ? parseInt(m[1], 10) : undefined
}
