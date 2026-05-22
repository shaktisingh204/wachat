/**
 * SabSMS approvals — pure heuristics module.
 *
 * Compliance scoring, undeclared-variable detection, and the SLA
 * constant live here so `node:test` can exercise them without dragging
 * `server-only` modules in.
 */

// Reviewer SLA — flag breach if a submitted template is older than this.
export const APPROVAL_SLA_MS = 4 * 60 * 60 * 1000; // 4 hours.

const COMPLIANCE_PENALTIES: Array<{
  pattern: RegExp;
  weight: number;
  reason: string;
}> = [
  { pattern: /\bfree\b/i, weight: 5, reason: "Contains 'FREE' marketing trigger" },
  { pattern: /\$\$\$/, weight: 10, reason: "Spammy currency emphasis" },
  { pattern: /!{3,}/, weight: 8, reason: "Multiple exclamation marks" },
  { pattern: /\b(click|tap)\s+(here|now)\b/i, weight: 5, reason: "Generic call-to-action" },
  { pattern: /[A-Z]{6,}/, weight: 6, reason: "Excessive uppercase" },
  { pattern: /\b(guarantee|guaranteed)\b/i, weight: 4, reason: "Guarantee language" },
];

/** Returns a 0-100 score where 100 = clean, 0 = high spam risk. */
export function computeComplianceScore(body: string): number {
  let penalty = 0;
  for (const rule of COMPLIANCE_PENALTIES) {
    if (rule.pattern.test(body)) penalty += rule.weight;
  }
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function detectUndeclaredVariables(
  body: string,
  declared: string[] | undefined,
): string[] {
  const declaredSet = new Set(declared ?? []);
  declaredSet.add("now"); // engine-supplied
  const used = new Set<string>();
  const matches = body.match(/\{\{\s*([\w.]+)\s*\}\}/g) ?? [];
  for (const m of matches) {
    const name = m.replace(/[{}]/g, "").trim();
    if (name) used.add(name);
  }
  const undeclared: string[] = [];
  for (const v of used) {
    if (!declaredSet.has(v)) undeclared.push(v);
  }
  return undeclared;
}

export interface AiVerdictAdvisory {
  recommendation: "approve" | "reject" | "review";
  confidence: number;
  rationale: string;
}

/**
 * TODO(LLM gateway): SabNode has no shared LLM gateway today. Mirroring
 * the stub in `/sabsms/templates/[id]/actions.ts`, this returns a
 * deterministic heuristic so reviewers see an advisory without a paid
 * model call. Replace with a real prompt when a gateway lands.
 */
export function buildAiVerdict(_body: string, score: number): AiVerdictAdvisory {
  if (score >= 80) {
    return {
      recommendation: "approve",
      confidence: 0.7,
      rationale: "No spam triggers detected; variables look declared.",
    };
  }
  if (score < 40) {
    return {
      recommendation: "reject",
      confidence: 0.65,
      rationale: "Multiple spam-trigger phrases or excessive emphasis.",
    };
  }
  return {
    recommendation: "review",
    confidence: 0.5,
    rationale: "Borderline content — reviewer judgement required.",
  };
}

export function wordDiff(
  a: string,
  b: string,
): Array<{ kind: "same" | "ins" | "del"; text: string }> {
  const aTok = a.split(/(\s+)/);
  const bTok = b.split(/(\s+)/);
  const n = aTok.length;
  const m = bTok.length;
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
