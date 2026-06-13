import 'server-only';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail vector RAG layer (plain server lib — no UI, no cron).
 *
 * Stores per-message embeddings in `SABMAIL_COLLECTIONS.ragChunks` and serves
 * brute-force cosine top-k retrieval entirely in TypeScript — no Atlas Vector
 * Search / `$vectorSearch` tier required. Fine up to tens of thousands of
 * chunks per workspace (an O(n·d) in-app scan).
 *
 * Embeddings ride the Vercel AI Gateway via the `ai` SDK: a bare
 * `provider/model` string auto-resolves through `@ai-sdk/gateway`. Auth comes
 * from `AI_GATEWAY_API_KEY` (or Vercel OIDC on the platform). When no key is
 * present — or the gateway call throws — `embedTexts` returns `null` and the
 * callers degrade with a clear, honest error rather than throwing.
 *
 * Verified against `ai@6.0.191`: `embedMany` returns
 * `{ embeddings: number[][] }` in input order; `dimensions` is an OpenAI-only
 * `providerOptions.openai` knob (Matryoshka) — keep it identical across index
 * + query embeds so every stored vector matches the query vector length.
 * ──────────────────────────────────────────────────────────────────── */

/** AI Gateway embedding model slug (`provider/model`). */
const EMBED_MODEL = 'openai/text-embedding-3-small';
/** Matryoshka dimension reduction — constant across index + query. */
const EMBED_DIMS = 512;
/** Per-text truncation cap (chars) before embedding. */
const MAX_TEXT_CHARS = 2000;
/** Upper bound on chunks loaded into memory for a single search. */
const SEARCH_SCAN_CAP = 4000;

/** A single email-message chunk persisted for retrieval. */
export interface SabmailRagChunk {
  workspaceId: string;
  accountId: string;
  uid: string;
  subject: string;
  from: string;
  date: string;
  text: string;
  embedding: number[];
  createdAt: Date;
}

/** Input shape for `ingestSabmailRag` (no embedding — this lib computes it). */
export interface SabmailRagChunkInput {
  accountId: string;
  uid: string;
  subject: string;
  from: string;
  date: string;
  text: string;
}

/** A scored retrieval hit returned by `ragSearch`. */
export interface SabmailRagHit {
  subject: string;
  from: string;
  date: string;
  uid: string;
  text: string;
  score: number;
}

export type IngestResult = { ok: boolean; count: number; error?: string };
export type SearchResult = {
  ok: boolean;
  hits?: SabmailRagHit[];
  error?: string;
};

/**
 * Cosine similarity of two equal-length vectors.
 *
 * Returns 0 for empty or zero-magnitude vectors (no divide-by-zero) and 0 on
 * a length mismatch (defensive — callers also pre-guard dims), so it never
 * throws inside a hot scan loop.
 */
export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    magA += x * x;
    magB += y * y;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Embed a batch of texts through the AI Gateway, preserving input order.
 *
 * Returns `null` (rather than throwing) when there is no `AI_GATEWAY_API_KEY`
 * configured, or when the gateway call fails for any reason — letting callers
 * degrade gracefully. An empty input yields an empty array (no network call).
 */
export async function embedTexts(values: string[]): Promise<number[][] | null> {
  if (values.length === 0) return [];
  // No gateway key (and no Vercel OIDC) → embeddings are unavailable.
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return null;
  }
  try {
    const { embedMany } = await import('ai');
    const result = (await embedMany({
      model: EMBED_MODEL,
      values,
      maxParallelCalls: 4,
      providerOptions: { openai: { dimensions: EMBED_DIMS } },
    } as unknown as Parameters<typeof embedMany>[0])) as unknown as {
      embeddings: number[][];
    };
    const embeddings = result?.embeddings;
    if (!Array.isArray(embeddings)) return null;
    return embeddings;
  } catch {
    // GatewayAuthenticationError / network / provider errors all degrade here.
    return null;
  }
}

/**
 * Embed the given email chunks and upsert them into `ragChunks`, keyed by
 * `{ workspaceId, accountId, uid }` so re-ingesting a message replaces its
 * vector in place (idempotent). Each chunk text is truncated to ~2000 chars
 * before embedding.
 */
export async function ingestSabmailRag(
  workspaceId: string,
  chunks: SabmailRagChunkInput[],
): Promise<IngestResult> {
  if (!workspaceId) {
    return { ok: false, count: 0, error: 'No active SabMail project.' };
  }
  if (chunks.length === 0) return { ok: true, count: 0 };

  try {
    const texts = chunks.map((c) => (c.text ?? '').slice(0, MAX_TEXT_CHARS));
    const embeddings = await embedTexts(texts);
    if (!embeddings) {
      return {
        ok: false,
        count: 0,
        error:
          'Embeddings are not available. Set AI_GATEWAY_API_KEY (or run `vercel env pull`) to enable SabMail RAG ingest.',
      };
    }
    if (embeddings.length !== chunks.length) {
      return {
        ok: false,
        count: 0,
        error: 'Embedding count did not match the chunk count.',
      };
    }

    const { db } = await connectToDatabase();
    const collection = db.collection(SABMAIL_COLLECTIONS.ragChunks);
    const now = new Date();

    const ops = chunks.map((chunk, i) => ({
      updateOne: {
        filter: {
          workspaceId,
          accountId: chunk.accountId,
          uid: chunk.uid,
        },
        update: {
          $set: {
            workspaceId,
            accountId: chunk.accountId,
            uid: chunk.uid,
            subject: chunk.subject ?? '',
            from: chunk.from ?? '',
            date: chunk.date ?? '',
            text: texts[i],
            embedding: embeddings[i],
            createdAt: now,
          } as SabmailRagChunk,
        },
        upsert: true,
      },
    }));

    await collection.bulkWrite(ops, { ordered: false });
    return { ok: true, count: chunks.length };
  } catch (error) {
    return { ok: false, count: 0, error: getErrorMessage(error) };
  }
}

/**
 * Embed the question and return the top-k most cosine-similar stored chunks
 * for this workspace. Loads up to a few thousand chunks for the workspace and
 * scores them in-process. Degrades with a clear error when embeddings are
 * unavailable.
 */
export async function ragSearch(
  workspaceId: string,
  question: string,
  topK = 6,
): Promise<SearchResult> {
  if (!workspaceId) {
    return { ok: false, error: 'No active SabMail project.' };
  }
  const trimmed = (question ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Ask a question to search your mail.' };
  }

  try {
    const embedded = await embedTexts([trimmed.slice(0, MAX_TEXT_CHARS)]);
    if (!embedded) {
      return {
        ok: false,
        error:
          'Embeddings are not available. Set AI_GATEWAY_API_KEY (or run `vercel env pull`) to enable SabMail AI search.',
      };
    }
    const queryVec = embedded[0];
    if (!queryVec || queryVec.length === 0) {
      return { ok: false, error: 'Could not embed the question.' };
    }

    const { db } = await connectToDatabase();
    const docs = (await db
      .collection(SABMAIL_COLLECTIONS.ragChunks)
      .find(
        { workspaceId },
        {
          projection: {
            embedding: 1,
            text: 1,
            subject: 1,
            from: 1,
            date: 1,
            uid: 1,
          },
        },
      )
      .limit(SEARCH_SCAN_CAP)
      .toArray()) as unknown as Array<{
      embedding?: number[];
      text?: string;
      subject?: string;
      from?: string;
      date?: string;
      uid?: string;
    }>;

    const scored: SabmailRagHit[] = [];
    for (const doc of docs) {
      const vec = doc.embedding;
      // Guard mismatched dims so cosine() never compares unequal lengths.
      if (!Array.isArray(vec) || vec.length !== queryVec.length) continue;
      scored.push({
        subject: doc.subject ?? '',
        from: doc.from ?? '',
        date: doc.date ?? '',
        uid: doc.uid ?? '',
        text: doc.text ?? '',
        score: cosine(queryVec, vec),
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const k = Number.isFinite(topK) && topK > 0 ? Math.floor(topK) : 6;
    return { ok: true, hits: scored.slice(0, k) };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
