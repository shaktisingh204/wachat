#!/usr/bin/env node
/**
 * SabSMS V2.12 — conversation-insights nightly miner
 * (`sabsms_conversation_insights`).
 *
 * For every workspace with conversation activity in the last 7 days,
 * runs the LLM map-reduce in `src/lib/sabsms/insights/mining.ts`
 * (topics + intent histogram) and INSERTS a fresh insights document —
 * history is retained so the inbox card can render trend arrows vs the
 * previous run. All thread text is PII-scrubbed before any LLM call.
 *
 * LLM calls go through the project's gateway ladder
 * (`src/lib/sabsms/agent/llm.ts` — AI_GATEWAY_API_KEY →
 * ANTHROPIC_API_KEY → OPENAI_API_KEY); with no key configured the run
 * exits 0 having done nothing (honest no-op, never fakes insights).
 *
 * Run under tsx (same interop pattern as scripts/sabsms-identity-nightly.mjs):
 *
 *   NODE_PATH=./src/workers/_stubs ./node_modules/.bin/tsx \
 *     scripts/sabsms-insights-nightly.mjs [--dry-run] [--workspace <id>]
 *
 * PM2 nightly registration (03:15 UTC, run-to-completion):
 *
 *   pm2 start ./node_modules/.bin/tsx \
 *     --name sabsms-insights-nightly \
 *     --cron-restart "15 3 * * *" --no-autorestart -- \
 *     scripts/sabsms-insights-nightly.mjs
 *
 * Required env: MONGODB_URI (or MONGO_URL) + optional MONGODB_DB
 * (default `sabnode`), plus one LLM gateway key.
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

// Default-import + destructure — tsx CommonJS interop (see the events worker).
import miningModule from '../src/lib/sabsms/insights/mining.ts';

const { mineConversations } = miningModule;

const DRY_RUN = process.argv.includes('--dry-run');
const wsFlagIdx = process.argv.indexOf('--workspace');
const ONLY_WORKSPACE = wsFlagIdx !== -1 ? process.argv[wsFlagIdx + 1] : null;
const WINDOW_DAYS = 7;

const uri = process.env.MONGODB_URI || process.env.MONGO_URL || '';
if (!uri) {
  console.error('[insights-nightly] MONGODB_URI is not set');
  process.exit(1);
}

const hasLlmKey = Boolean(
  process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY,
);
if (!hasLlmKey) {
  console.log(
    '[insights-nightly] no LLM gateway key configured (AI_GATEWAY_API_KEY / ' +
      'ANTHROPIC_API_KEY / OPENAI_API_KEY) — nothing to do',
  );
  process.exit(0);
}

const client = new MongoClient(uri, { maxPoolSize: 4 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || 'sabnode');

const startedAt = Date.now();
const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
const log = (message, extra) =>
  console.log(
    `[insights-nightly] ${message}${extra ? ` ${JSON.stringify(extra)}` : ''}`,
  );

try {
  const workspaceIds = ONLY_WORKSPACE
    ? [ONLY_WORKSPACE]
    : await db
        .collection('sabsms_conversations')
        .distinct('workspaceId', { lastMessageAt: { $gte: since } });

  let mined = 0;
  let skipped = 0;
  for (const workspaceId of workspaceIds) {
    if (!workspaceId) continue;
    if (DRY_RUN) {
      log('would mine workspace', { workspaceId });
      skipped += 1;
      continue;
    }
    try {
      const doc = await mineConversations(db, String(workspaceId), since, { log });
      if (doc) mined += 1;
      else skipped += 1;
    } catch (err) {
      console.error(
        `[insights-nightly] workspace ${workspaceId} failed`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  log(
    `done: workspaces=${workspaceIds.length} mined=${mined} skipped=${skipped} ` +
      `dryRun=${DRY_RUN} in ${Math.round((Date.now() - startedAt) / 1000)}s`,
  );
} catch (err) {
  console.error('[insights-nightly] failed', err);
  process.exitCode = 1;
} finally {
  await client.close().catch(() => undefined);
}
