/**
 * Server-only wiring for `agent-bridge.ts`.
 *
 * `agent-bridge.ts` is loaded by forge blocks, which transitively land in
 * the Client Component SSR bundle of the SabFlow editor. We therefore
 * cannot import `@/lib/agents` or `@/lib/mongodb` from there — Turbopack
 * statically analyses `await import(...)` and `server-only` modules on
 * that chain blow up the build.
 *
 * This file is the *only* place that touches those server-only modules.
 * Server entry points (the SabFlow API routes, the worker, etc.) import
 * this file once at startup; its top-level side effects register a real
 * AgentRunner + TranscriptPersister with `agent-bridge.ts`. Client bundles
 * never see this file.
 */

import 'server-only';

import { runAgent } from '@/lib/agents/runner';
import { connectToDatabase } from '@/lib/mongodb';
import {
  setAgentRunner,
  setTranscriptPersister,
  type AgentRunner,
  type TranscriptPersister,
} from './agent-bridge';

const realRunner: AgentRunner = async (agentId, input, options) => {
  return runAgent(agentId, input, {
    tenantId: options.tenantId,
    userId: options.userId,
    meta: options.meta,
  });
};

const realPersister: TranscriptPersister = async (record) => {
  const { db } = await connectToDatabase();
  await db.collection('flow_run_agent_transcripts').insertOne({
    ...record,
    createdAt: new Date(),
  });
};

setAgentRunner(realRunner);
setTranscriptPersister(realPersister);
