import 'server-only';

/**
 * Live-mail binding — the production path that ties an arriving message into
 * SabMail's collaboration + automation layers. Called from both the inbound
 * webhook (`/api/webhooks/sabmail-inbound`) and the background sync worker
 * (`src/workers/sabmail-sync.ts`) so every freshly-seen message — however it
 * lands — gets the same treatment:
 *
 *   1. Conversation  — upsert a team-shared conversation keyed on the sender.
 *   2. Screener      — register first-time senders as `pending` (HEY-style).
 *   3. Rules         — evaluate enabled rules' match against from/subject.
 *   4. Journeys      — fire the `inbound_email` trigger (auto-enroll).
 *
 * When the Rust engine is enabled (`SABMAIL_ENABLED=true`) steps 1–3 run there
 * (`POST /v1/inbound`); otherwise they run in-process against the same
 * `sabmail_*` collections. Step 4 always runs in-process (the engine does not
 * own enrollment). Everything is best-effort — binding never throws into the
 * caller, so a binding hiccup can't drop an inbound message.
 */

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { matchesSabmailRule, type SabmailRuleCompiled } from '@/lib/sabmail/rules-engine';
import { enrollMatchingJourneys } from '@/lib/sabmail/journey-engine';
import { isSabmailEngineEnabled, sabmailEngine } from '@/lib/sabmail/engine-client';

export interface InboundBindInput {
  workspaceId: string;
  from: string;
  fromName?: string;
  subject?: string;
  messageId?: string;
}

export interface InboundRuleAction {
  action: string;
  label?: string;
}

export interface InboundBindResult {
  screenerDecision: string;
  ruleActions: InboundRuleAction[];
  bound: boolean;
  via: 'engine' | 'in-process' | 'skipped';
  /** How many journeys the sender was enrolled into (inbound_email trigger). */
  enrolled: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Bind one inbound message. Best-effort; never throws into the caller. */
export async function bindInboundMessage(
  input: InboundBindInput,
): Promise<InboundBindResult> {
  const from = String(input.from ?? '').trim().toLowerCase();
  const workspaceId = String(input.workspaceId ?? '').trim();
  if (!workspaceId || !from || !EMAIL_RE.test(from)) {
    return { screenerDecision: 'pending', ruleActions: [], bound: false, via: 'skipped', enrolled: 0 };
  }
  const subject = String(input.subject ?? '').trim();

  let screenerDecision = 'pending';
  let ruleActions: InboundRuleAction[] = [];
  let bound = false;
  let via: InboundBindResult['via'] = 'skipped';

  // Prefer the Rust engine when enabled; fall back to in-process on any error.
  if (isSabmailEngineEnabled()) {
    try {
      const res = await sabmailEngine.processInbound({
        workspaceId,
        from,
        fromName: input.fromName,
        subject,
        messageId: input.messageId,
      });
      screenerDecision = res.screenerDecision;
      ruleActions = res.ruleActions ?? [];
      bound = res.bound;
      via = 'engine';
    } catch {
      via = 'skipped';
    }
  }

  if (via !== 'engine') {
    try {
      const r = await bindInProcess({ workspaceId, from, fromName: input.fromName, subject, messageId: input.messageId });
      screenerDecision = r.screenerDecision;
      ruleActions = r.ruleActions;
      bound = r.bound;
      via = 'in-process';
    } catch {
      /* leave defaults — never throw */
    }
  }

  // Journey trigger (always in-process; the engine does not own enrollment).
  let enrolled = 0;
  try {
    const e = await enrollMatchingJourneys(workspaceId, 'inbound_email', from);
    enrolled = e.enrolled;
  } catch {
    /* non-fatal */
  }

  return { screenerDecision, ruleActions, bound, via, enrolled };
}

/* ── in-process binder (mirrors services/sabmail-engine/src/inbound.rs) ──── */

interface StoredRuleDoc {
  compiled?: SabmailRuleCompiled;
  enabled?: boolean;
}

async function bindInProcess(input: {
  workspaceId: string;
  from: string;
  fromName?: string;
  subject: string;
  messageId?: string;
}): Promise<{ screenerDecision: string; ruleActions: InboundRuleAction[]; bound: boolean }> {
  const { workspaceId, from, subject } = input;
  const now = new Date();
  const { db } = await connectToDatabase();

  // 1) Screener — register first-time senders as pending; read the decision.
  const screener = db.collection(SABMAIL_COLLECTIONS.screener);
  await screener.updateOne(
    { workspaceId, email: from },
    { $setOnInsert: { workspaceId, email: from, decision: 'pending', firstSeenAt: now } } as never,
    { upsert: true },
  );
  const screenerDoc = (await screener.findOne(
    { workspaceId, email: from },
    { projection: { decision: 1 } },
  )) as { decision?: string } | null;
  const screenerDecision = String(screenerDoc?.decision ?? 'pending');

  // 2) Conversation — upsert the team-shared thread keyed on the sender.
  const convoStatus = screenerDecision === 'denied' ? 'screened' : 'open';
  await db.collection(SABMAIL_COLLECTIONS.conversations).updateOne(
    { workspaceId, fromEmail: from },
    {
      $set: {
        subject,
        lastMessageAt: now,
        status: convoStatus,
        lastMessageId: input.messageId ?? '',
      },
      $setOnInsert: {
        workspaceId,
        fromEmail: from,
        fromName: input.fromName ?? '',
        createdAt: now,
      },
    } as never,
    { upsert: true },
  );

  // 3) Rules — evaluate enabled rules' match against from/subject.
  const ruleActions: InboundRuleAction[] = [];
  const rules = (await db
    .collection(SABMAIL_COLLECTIONS.rules)
    .find({ workspaceId, enabled: { $ne: false } })
    .limit(200)
    .toArray()) as StoredRuleDoc[];
  for (const rule of rules) {
    if (!rule.compiled) continue;
    const hit = matchesSabmailRule(rule.compiled, {
      fromName: input.fromName ?? '',
      fromEmail: from,
      subject,
      date: null,
    });
    if (hit) {
      ruleActions.push({ action: rule.compiled.action, label: rule.compiled.label });
    }
  }

  return { screenerDecision, ruleActions, bound: true };
}
