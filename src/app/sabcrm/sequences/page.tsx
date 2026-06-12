/**
 * SabCRM — Sequences (`/sabcrm/sequences`), 20ui.
 *
 * Server entry for the Sales suite's cadences: lists the active project's
 * sequences through the gated `listSabcrmSequences` action (full
 * session → project → RBAC → plan pipeline, then the project-scoped Rust
 * mount `/v1/sabcrm/sequences`).
 *
 * Active-enrollment counts: there is no per-sequence count endpoint, so the
 * page fetches the first page (≤200) of the project's ACTIVE enrollments via
 * `listSabcrmSequenceEnrollments` and tallies them per sequence. Counts are
 * therefore capped by that page size on very large projects.
 *
 * Email templates (for the builder's email-step prefill Select) come from
 * `listTemplatesTw('email')` — best-effort: a failure leaves the Select out
 * rather than failing the page.
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM
 * `layout.tsx`. The Rust engine may be down at dev time — the action
 * normalises that into `{ ok: false, error }`, which renders as an inline
 * error state instead of crashing the route.
 */

import * as React from 'react';

import {
  listSabcrmSequenceEnrollments,
  listSabcrmSequences,
} from '@/app/actions/sabcrm-sequences.actions';
import { listTemplatesTw } from '@/app/actions/sabcrm-templates.actions';
import {
  SequencesClient,
  type SequenceRow,
  type SequenceTemplateOption,
} from './sequences-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sequences — SabCRM',
};

export default async function SabcrmSequencesPage(): Promise<React.JSX.Element> {
  const [seqRes, enrollRes, templatesRes] = await Promise.all([
    listSabcrmSequences({ limit: 200 }),
    listSabcrmSequenceEnrollments({ status: 'active', limit: 200 }),
    listTemplatesTw('email'),
  ]);

  // Tally active enrollments per sequence (first ≤200 active enrollments —
  // no per-sequence count endpoint exists yet).
  const activeCounts = new Map<string, number>();
  if (enrollRes.ok) {
    for (const en of enrollRes.data.enrollments) {
      activeCounts.set(en.sequenceId, (activeCounts.get(en.sequenceId) ?? 0) + 1);
    }
  }

  const rows: SequenceRow[] = seqRes.ok
    ? seqRes.data.sequences.map((seq) => ({
        id: seq.id,
        name: seq.name,
        status: seq.status,
        steps: seq.steps,
        unenrollOnReply: seq.settings?.unenrollOnReply ?? true,
        activeEnrollments: activeCounts.get(seq.id) ?? 0,
        createdAt: seq.createdAt,
      }))
    : [];

  // Best-effort: builder works without templates (inline subject/body).
  const templates: SequenceTemplateOption[] = templatesRes.ok
    ? templatesRes.data.map((t) => ({
        id: t.id,
        name: t.name,
        subject: t.subject ?? '',
        body: t.body,
      }))
    : [];

  return (
    <SequencesClient
      initialRows={rows}
      templates={templates}
      initialError={seqRes.ok ? null : seqRes.error}
    />
  );
}
