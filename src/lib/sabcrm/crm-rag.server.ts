import 'server-only';

/**
 * SabCRM — "ask-your-CRM" grounded answer (server-only).
 *
 * Retrieves records relevant to a natural-language question using the records
 * engine's existing substring search (in-house keyword retrieval — no vector
 * store), ranks + formats them via the pure `./crm-rag.ts`, and asks the shared
 * LLM (`generateSabcrmText`) to answer grounded ONLY on those records. Honest
 * degradation: when no LLM provider is configured it returns the helper's
 * error; when nothing matches it still answers ("no matching records").
 *
 * Reads go through the native owner-scoped `listRecords` ({projectId, userId}),
 * so a user can only ground on records they can already see.
 */

import { listRecords } from './records.server';
import { listObjects } from './objects.server';
import { generateSabcrmText } from './ai-llm.server';
import { semanticSearch } from './embeddings.server';
import {
  rankCandidates,
  buildGroundingContext,
  buildGroundedPrompt,
  ASK_CRM_SYSTEM,
  type RagCandidate,
} from './crm-rag';

export { rankCandidates, buildGroundingContext, type RagCandidate } from './crm-rag';

/** Max objects scanned + records pulled per object for one question. */
const MAX_OBJECTS = 6;
const PER_OBJECT = 6;
const TOP_K = 12;

export interface GroundedSource {
  object: string;
  id: string;
  label: string;
}

export type GroundedAnswer =
  | { ok: true; answer: string; sources: GroundedSource[] }
  | { ok: false; error: string };

/**
 * Keyword retrieval: owner-scoped substring search across the top objects,
 * then keyword-relevance ranked. Best-effort (failures → fewer candidates).
 */
async function keywordRetrieve(
  projectId: string,
  userId: string,
  q: string,
  topK: number,
): Promise<RagCandidate[]> {
  const candidates: RagCandidate[] = [];
  try {
    const objects = await listObjects(projectId);
    for (const obj of objects.slice(0, MAX_OBJECTS)) {
      try {
        const page = await listRecords(projectId, userId, {
          object: obj.slug,
          search: q,
          pageSize: PER_OBJECT,
        });
        for (const r of page.records) {
          candidates.push({ id: r._id, object: obj.slug, label: r.label, data: r.data ?? {} });
        }
      } catch {
        /* skip an object that fails to search */
      }
    }
  } catch {
    /* no objects / engine down → empty */
  }
  return rankCandidates(candidates, q, topK);
}

/**
 * Answer a natural-language question grounded in the project's records.
 *
 * Prefers SEMANTIC retrieval (embed query → cosine over `sabcrm_embeddings` →
 * ACL-hydrated through the owner-scoped read in `semanticSearch`); falls back
 * to keyword retrieval when embeddings are unavailable/unconfigured OR return
 * nothing (cold index). Semantic candidates are already cosine-ranked, so they
 * go straight to the context builder — running keyword `rankCandidates` on them
 * would wrongly drop semantic-only matches. Never throws.
 */
export async function groundedCrmAnswer(
  projectId: string,
  userId: string,
  query: string,
): Promise<GroundedAnswer> {
  const q = (query || '').trim();
  if (!q) return { ok: false, error: 'A question is required.' };

  let ranked: RagCandidate[];
  const semantic = await semanticSearch(projectId, userId, q, { topK: TOP_K });
  if (semantic && semantic.length > 0) {
    ranked = semantic; // already ranked + ACL-hydrated — do NOT re-rank
  } else {
    ranked = await keywordRetrieve(projectId, userId, q, TOP_K);
  }

  const context = buildGroundingContext(ranked);
  const prompt = buildGroundedPrompt(q, context);

  const llm = await generateSabcrmText({ system: ASK_CRM_SYSTEM, prompt });
  if (!llm.ok) return { ok: false, error: llm.error };

  return {
    ok: true,
    answer: llm.text,
    sources: ranked.map((r) => ({ object: r.object, id: r.id, label: r.label })),
  };
}
