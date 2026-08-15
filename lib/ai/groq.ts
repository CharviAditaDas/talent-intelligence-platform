import 'server-only';
import Groq from 'groq-sdk';
import { z, type ZodType } from 'zod';

/**
 * The only place in the codebase that talks to Groq (§6).
 * The API key is read from the server environment and never leaves it.
 */

let client: Groq | null = null;

function groq(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new AiError('config', 'GROQ_API_KEY is not configured on the server.');
  if (!client) client = new Groq({ apiKey, timeout: 45_000, maxRetries: 0 });
  return client;
}

export type AiErrorKind =
  | 'config'
  | 'rate_limit'
  | 'unavailable'
  | 'timeout'
  | 'malformed'
  | 'refused'
  | 'unknown';

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AiError';
  }
  /** §66/§67: rate limits and outages are queued and retried; bad JSON is retried once. */
  get retryable() {
    return this.kind === 'rate_limit' || this.kind === 'unavailable' || this.kind === 'timeout' || this.kind === 'malformed';
  }
}

function classify(err: unknown): AiError {
  if (err instanceof AiError) return err;
  const anyErr = err as { status?: number; message?: string; headers?: Record<string, string> };
  const status = anyErr?.status;
  const message = anyErr?.message ?? 'Unknown AI provider error.';
  if (status === 429) {
    const header = anyErr.headers?.['retry-after'];
    const retryAfterMs = header ? Number(header) * 1000 : undefined;
    return new AiError('rate_limit', 'Groq rate limit reached.', Number.isFinite(retryAfterMs) ? retryAfterMs : 20_000);
  }
  if (status === 401 || status === 403) return new AiError('config', 'Groq rejected the API credentials.');
  if (status && status >= 500) return new AiError('unavailable', 'Groq is temporarily unavailable.');
  if (/timeout|aborted|ETIMEDOUT/i.test(message)) return new AiError('timeout', 'Groq request timed out.');
  return new AiError('unknown', message);
}

export interface CompletionMeta {
  model: string;
  promptTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface StructuredResult<T> {
  data: T;
  meta: CompletionMeta;
}

/**
 * Requests a JSON object from Groq and validates it against a Zod schema
 * before it is allowed anywhere near the database (§7).
 * A response that parses but fails the schema is treated as malformed and
 * retried once with a corrective instruction rather than being persisted.
 */
export async function structured<T>(opts: {
  system: string;
  user: string;
  schema: ZodType<T>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<StructuredResult<T>> {
  const model = opts.model ?? process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
  const started = Date.now();

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: opts.system },
    { role: 'user', content: opts.user },
  ];

  let lastMalformed: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let raw: string;
    let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;

    try {
      const completion = await groq().chat.completions.create({
        model,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 4096,
        response_format: { type: 'json_object' },
      });
      raw = completion.choices[0]?.message?.content ?? '';
      usage = completion.usage;
    } catch (err) {
      throw classify(err);
    }

    const meta: CompletionMeta = {
      model,
      promptTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
      latencyMs: Date.now() - started,
    };

    const parsed = tryParse(raw);
    if (parsed.ok) {
      const validated = opts.schema.safeParse(parsed.value);
      if (validated.success) return { data: validated.data, meta };
      lastMalformed = validated.error.issues
        .slice(0, 6)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
    } else {
      lastMalformed = 'Response was not valid JSON.';
    }

    // One corrective round trip, then give up and let the queue decide.
    messages.push({ role: 'assistant', content: raw.slice(0, 2000) });
    messages.push({
      role: 'user',
      content:
        `That response did not satisfy the required schema (${lastMalformed}). ` +
        `Reply again with a single valid JSON object only. No prose, no markdown fences.`,
    });
  }

  throw new AiError('malformed', `Groq returned data that failed schema validation. ${lastMalformed ?? ''}`.trim());
}

function tryParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return { ok: true, value: JSON.parse(cleaned) };
  } catch {
    // Occasionally a model prefixes prose; salvage the outermost object.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return { ok: true, value: JSON.parse(cleaned.slice(start, end + 1)) };
      } catch { /* fall through */ }
    }
    return { ok: false };
  }
}

/** Shared schema fragment: every evidence claim must cite its source (§89). */
export const evidenceSchema = z.object({
  state: z.enum(['demonstrated', 'insufficient', 'not_demonstrated']),
  evidence: z.string().nullable().default(null),
});
