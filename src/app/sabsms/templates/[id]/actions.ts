"use server";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";

import { getCachedSession } from "@/lib/server-cache";
import { getSabsmsCollections } from "@/lib/sabsms/db/collections";
import { extractVariables } from "@/lib/sabsms/render";
import type {
  SabsmsTemplate,
  SabsmsTemplateBody,
  SabsmsTemplateCategory,
  SabsmsTemplateStatus,
} from "@/lib/sabsms/types";

import type { TemplateEditorMetadata, VariableDefault } from "./types";

// ─── Auth + workspace ────────────────────────────────────────────────────

async function resolveWorkspace(): Promise<
  { ok: true; workspaceId: string } | { ok: false; error: string }
> {
  const session = await getCachedSession();
  const userId = (session?.user as any)?._id;
  if (!userId) return { ok: false, error: "unauthorized" };
  return { ok: true, workspaceId: (await getSabsmsWorkspaceId()) ?? "" };
}

// ─── Input shapes ────────────────────────────────────────────────────────

export interface SaveTemplateInput {
  id: string; // empty / "new" => create
  name: string;
  category: SabsmsTemplateCategory;
  bodies: SabsmsTemplateBody[];
  variableDefaults: VariableDefault[];
  metadata: TemplateEditorMetadata;
}

export interface SubmitForApprovalInput extends SaveTemplateInput {
  reviewerNotes: string;
}

export type SaveResult =
  | { ok: true; id: string; status: SabsmsTemplateStatus }
  | { ok: false; error: string };

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Auto-extract template variables on save via the shared renderer
 * (`@/lib/sabsms/render`). Named vars keep their key (fallbacks
 * stripped, `now` is a built-in — excluded); DLT `{#var#}` slots are
 * recorded as `#1`…`#n` so the send path knows how many positional
 * values a campaign must supply.
 */
function extractVariableNames(bodies: SabsmsTemplateBody[]): string[] {
  const set = new Set<string>();
  let maxPositional = 0;
  for (const b of bodies) {
    const { named, positionalCount } = extractVariables(b.body);
    for (const name of named) {
      if (name !== "now") set.add(name);
    }
    maxPositional = Math.max(maxPositional, positionalCount);
  }
  const out = [...set];
  for (let i = 1; i <= maxPositional; i++) out.push(`#${i}`);
  return out;
}

function buildDocPatch(input: SaveTemplateInput, status: SabsmsTemplateStatus) {
  const variables = extractVariableNames(input.bodies);
  // The base SabsmsTemplate shape does not expose `autoLinkWrap`,
  // `footerInjection`, or `variableDefaults`; we persist them alongside
  // the canonical fields under the same document for the editor to
  // round-trip. The Rust engine ignores unknown fields.
  return {
    name: input.name,
    category: input.category,
    bodies: input.bodies.filter((b) => b.body.trim().length > 0),
    variables,
    dlt: {
      principalEntityId: input.metadata.dlt.principalEntityId || undefined,
      templateId: input.metadata.dlt.templateId || undefined,
      headerId: input.metadata.dlt.headerId || undefined,
      contentCategory: input.metadata.dlt.contentCategory || undefined,
    },
    tendlc: {
      brandId: input.metadata.tendlc.brandId || undefined,
      campaignId: input.metadata.tendlc.campaignId || undefined,
      useCase: input.metadata.tendlc.useCase || undefined,
      sampleMessages: input.metadata.tendlc.sampleMessages.filter(Boolean),
    },
    status,
    autoLinkWrap: input.metadata.tendlc.autoLinkWrap,
    footerInjection: input.metadata.tendlc.footerInjection,
    variableDefaults: input.variableDefaults,
    updatedAt: new Date(),
  } satisfies Partial<SabsmsTemplate> & Record<string, unknown>;
}

async function upsert(
  input: SaveTemplateInput,
  status: SabsmsTemplateStatus,
  reviewerNotes?: string,
): Promise<SaveResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  if (!input.name.trim()) return { ok: false, error: "Template name is required" };
  if (!input.bodies.some((b) => b.body.trim().length > 0)) {
    return { ok: false, error: "At least one locale body is required" };
  }

  const { cols } = await getSabsmsCollections();
  const patch = buildDocPatch(input, status) as Record<string, unknown>;
  if (reviewerNotes !== undefined) patch.reviewerNotes = reviewerNotes;

  const now = new Date();
  const historyEntry = {
    id: new ObjectId().toString(),
    timestamp: now.toISOString(),
    status,
    bodies: input.bodies,
    variableDefaults: input.variableDefaults,
  };

  if (!input.id || input.id === "new") {
    const insert = {
      ...patch,
      workspaceId: ws.workspaceId,
      createdAt: now,
      history: [historyEntry],
    } as unknown as SabsmsTemplate;
    const res = await cols.templates.insertOne(insert);
    revalidatePath("/sabsms/templates");
    return {
      ok: true,
      id: String(res.insertedId),
      status,
    };
  }

  let oid: ObjectId;
  try {
    oid = new ObjectId(input.id);
  } catch {
    return { ok: false, error: "invalid template id" };
  }
  await cols.templates.updateOne(
    { _id: oid, workspaceId: ws.workspaceId },
    { 
      $set: patch,
      $push: { history: { $each: [historyEntry], $position: 0 } }
    } as any,
  );
  revalidatePath(`/sabsms/templates/${input.id}`);
  revalidatePath("/sabsms/templates");
  return { ok: true, id: input.id, status };
}

// ─── Public server actions ──────────────────────────────────────────────

export async function saveDraft(input: SaveTemplateInput): Promise<SaveResult> {
  return upsert(input, "draft");
}

export async function publishTemplate(
  input: SaveTemplateInput,
): Promise<SaveResult> {
  return upsert(input, "approved");
}

export async function submitForApproval(
  input: SubmitForApprovalInput,
): Promise<SaveResult> {
  return upsert(input, "submitted", input.reviewerNotes);
}

export async function withdrawTemplate(id: string): Promise<SaveResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;
  if (!id || id === "new") return { ok: false, error: "no id" };
  let oid: ObjectId;
  try {
    oid = new ObjectId(id);
  } catch {
    return { ok: false, error: "invalid template id" };
  }
  const { cols } = await getSabsmsCollections();
  await cols.templates.updateOne(
    { _id: oid, workspaceId: ws.workspaceId },
    { $set: { status: "draft" as SabsmsTemplateStatus, updatedAt: new Date() } },
  );
  revalidatePath(`/sabsms/templates/${id}`);
  return { ok: true, id, status: "draft" };
}

// ─── AI features (#11, #12) ─────────────────────────────────────────────

export type AiRewriteMode =
  | "shorter"
  | "friendlier"
  | "add_cta"
  | "translate";

export interface AiRewriteInput {
  body: string;
  mode: AiRewriteMode;
  /** Required when mode === "translate". */
  targetLocale?: string;
}

export type AiRewriteResult =
  | { ok: true; body: string; note?: string }
  | { ok: false; error: string };

/**
 * TODO(LLM gateway): The project has no shared LLM gateway today (see
 * `src/lib/ai/embeddings.ts` — embeddings only). When a gateway lands,
 * this action should:
 *   1. Scrub PII (phones/emails) from `input.body` before the prompt.
 *   2. Call the gateway with a system prompt scoped to the mode.
 *   3. Return the rewritten body.
 *
 * For now we return a deterministic heuristic-based stub so the UI is
 * exercisable end-to-end without an API key.
 */
export async function runAiRewrite(
  input: AiRewriteInput,
): Promise<AiRewriteResult> {
  if (!input.body.trim()) return { ok: false, error: "empty body" };

  const note =
    "Stub rewrite — wire up an LLM gateway under src/lib/ai/ to enable real AI rewrites.";

  switch (input.mode) {
    case "shorter": {
      const sentences = input.body.split(/(?<=[.!?])\s+/);
      const trimmed = sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(" ");
      return { ok: true, body: trimmed, note };
    }
    case "friendlier": {
      const body = input.body
        .replace(/^Dear /i, "Hi ")
        .replace(/Regards,?/gi, "Cheers!")
        .replace(/\.\s*$/, "! ");
      return { ok: true, body: `${body} :)`, note };
    }
    case "add_cta": {
      const body = `${input.body.trimEnd()}\n\nTap here to act now: {{ cta_url }}`;
      return { ok: true, body, note };
    }
    case "translate": {
      if (!input.targetLocale) {
        return { ok: false, error: "target locale required" };
      }
      const body = `[${input.targetLocale.toUpperCase()}] ${input.body}`;
      return { ok: true, body, note };
    }
    default:
      return { ok: false, error: "unknown mode" };
  }
}

export interface RunTranslationInput {
  body: string;
  targetLocale: string;
}

export async function runTranslation(
  input: RunTranslationInput,
): Promise<AiRewriteResult> {
  return runAiRewrite({
    body: input.body,
    mode: "translate",
    targetLocale: input.targetLocale,
  });
}

// ─── Diff vs last published (#18) ────────────────────────────────────────

export interface DiffResult {
  ok: true;
  segments: Array<{ kind: "same" | "ins" | "del"; text: string }>;
  hasPrevious: boolean;
}

export type DiffActionResult = DiffResult | { ok: false; error: string };

/**
 * Word-level diff against the last published body for the given locale.
 * If no published version exists yet, returns the current body as
 * `same` segments with `hasPrevious: false`.
 */
export async function diffAgainstPublished(input: {
  id: string;
  locale: string;
  current: string;
}): Promise<DiffActionResult> {
  const ws = await resolveWorkspace();
  if (!ws.ok) return ws;

  if (!input.id || input.id === "new") {
    return { ok: true, hasPrevious: false, segments: [{ kind: "same", text: input.current }] };
  }

  let oid: ObjectId;
  try {
    oid = new ObjectId(input.id);
  } catch {
    return { ok: false, error: "invalid template id" };
  }

  const { cols } = await getSabsmsCollections();
  // `lastPublishedBodies` is a sibling field we persist on publish.
  const doc = (await cols.templates.findOne(
    { _id: oid, workspaceId: ws.workspaceId },
    { projection: { lastPublishedBodies: 1, bodies: 1, status: 1 } },
  )) as
    | (SabsmsTemplate & { lastPublishedBodies?: SabsmsTemplateBody[] })
    | null;

  const previous =
    doc?.lastPublishedBodies?.find((b) => b.locale === input.locale)?.body ??
    (doc?.status === "approved"
      ? doc.bodies?.find((b) => b.locale === input.locale)?.body
      : undefined);

  if (!previous) {
    return {
      ok: true,
      hasPrevious: false,
      segments: [{ kind: "same", text: input.current }],
    };
  }

  return {
    ok: true,
    hasPrevious: true,
    segments: tokenDiff(previous, input.current),
  };
}

function tokenDiff(
  a: string,
  b: string,
): Array<{ kind: "same" | "ins" | "del"; text: string }> {
  const aTok = a.split(/(\s+)/);
  const bTok = b.split(/(\s+)/);
  const n = aTok.length;
  const m = bTok.length;
  // LCS DP — quadratic; fine for SMS-sized bodies.
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (aTok[i] === bTok[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: Array<{ kind: "same" | "ins" | "del"; text: string }> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aTok[i] === bTok[j]) {
      out.push({ kind: "same", text: aTok[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "del", text: aTok[i] });
      i++;
    } else {
      out.push({ kind: "ins", text: bTok[j] });
      j++;
    }
  }
  while (i < n) out.push({ kind: "del", text: aTok[i++] });
  while (j < m) out.push({ kind: "ins", text: bTok[j++] });
  return out;
}
