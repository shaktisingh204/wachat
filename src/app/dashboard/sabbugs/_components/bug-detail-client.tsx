'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button, Card, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

import {
  createComment,
  deleteComment,
  updateBug,
} from '@/app/actions/bug-tracker.actions';
import type { BugDoc, BugStatus } from '@/lib/rust-client/bug-tracker-bugs';
import type { BugCommentDoc } from '@/lib/rust-client/bug-tracker-comments';
import type { BugHistoryEntryDoc } from '@/lib/rust-client/bug-tracker-history';
import type { BugVersionDoc } from '@/lib/rust-client/bug-tracker-versions';

import { BugForm } from './bug-form';
import {
  BUG_STATUSES,
  BugPriorityBadge,
  BugSeverityBadge,
  BugStatusBadge,
  bugTitle,
  type ProjectOption,
} from './bug-shared';

type DetailTab = 'overview' | 'comments' | 'history' | 'related';

export interface BugDetailClientProps {
  bug: BugDoc;
  comments: BugCommentDoc[];
  history: BugHistoryEntryDoc[];
  relatedBugs: BugDoc[];
  versions: BugVersionDoc[];
  projectOptions: ProjectOption[];
}

export function BugDetailClient({
  bug,
  comments,
  history,
  relatedBugs,
  versions,
  projectOptions,
}: BugDetailClientProps) {
  const [activeTab, setActiveTab] = React.useState<DetailTab>('overview');

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
            Bug · {bug._id.slice(-8)}
          </p>
          <h1 className="text-xl font-semibold text-[var(--st-text)]">
            {bugTitle(bug)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <BugStatusBadge status={bug.status} />
            <BugSeverityBadge severity={bug.severity} />
            <BugPriorityBadge priority={bug.priority} />
          </div>
        </div>
        <StatusActions bug={bug} />
      </header>

      <SegmentedNav active={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' ? (
        <BugForm
          bug={bug}
          projectOptions={projectOptions}
          versions={versions}
        />
      ) : null}

      {activeTab === 'comments' ? (
        <CommentsTab bug={bug} initialComments={comments} />
      ) : null}

      {activeTab === 'history' ? <HistoryTab entries={history} /> : null}

      {activeTab === 'related' ? <RelatedTab bugs={relatedBugs} /> : null}
    </div>
  );
}

function SegmentedNav({
  active,
  onChange,
}: {
  active: DetailTab;
  onChange: (next: DetailTab) => void;
}) {
  const items: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'comments', label: 'Comments' },
    { id: 'history', label: 'History' },
    { id: 'related', label: 'Related' },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-1">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onChange(it.id)}
          className={
            active === it.id
              ? 'rounded bg-[var(--st-bg-secondary)] px-3 py-1 text-sm font-medium text-[var(--st-text)] shadow-sm'
              : 'rounded px-3 py-1 text-sm text-[var(--st-text-secondary)] hover:text-[var(--st-text)]'
          }
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function StatusActions({ bug }: { bug: BugDoc }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);

  async function setStatus(status: BugStatus) {
    setBusy(true);
    const res = await updateBug(bug._id, { status });
    setBusy(false);
    if (res.error) {
      toast?.error?.(res.error);
      return;
    }
    toast?.success?.(`Status set to ${status}.`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {BUG_STATUSES.filter((s) => s !== bug.status).map((s) => (
        <Button
          key={s}
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setStatus(s)}
        >
          Mark {s}
        </Button>
      ))}
    </div>
  );
}

function CommentsTab({
  bug,
  initialComments,
}: {
  bug: BugDoc;
  initialComments: BugCommentDoc[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [comments, setComments] =
    React.useState<BugCommentDoc[]>(initialComments);
  const [body, setBody] = React.useState('');
  const [attachments, setAttachments] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    const res = await createComment({
      bugId: bug._id,
      body: body.trim(),
      attachmentIds: attachments,
    });
    setBusy(false);
    if (res.error) {
      toast?.error?.(res.error);
      return;
    }
    if (res.comment) setComments((prev) => [...prev, res.comment!]);
    setBody('');
    setAttachments([]);
    router.refresh();
  }

  async function remove(id: string) {
    const res = await deleteComment(id, bug._id);
    if (res.deleted) {
      setComments((prev) => prev.filter((c) => c._id !== id));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <Textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment in markdown…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <SabFilePickerButton
            onPick={(p: SabFilePick) =>
              setAttachments((prev) => [...prev, p.id])
            }
          >
            + Attach
          </SabFilePickerButton>
          {attachments.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2 py-1 text-xs"
            >
              <code className="font-mono">{id.slice(-6)}</code>
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() =>
                  setAttachments((prev) => prev.filter((x) => x !== id))
                }
              >
                ×
              </button>
            </span>
          ))}
          <span className="ml-auto" />
          <Button onClick={submit} disabled={busy || !body.trim()}>
            {busy ? 'Posting…' : 'Post comment'}
          </Button>
        </div>
      </Card>

      {comments.length === 0 ? (
        <p className="text-sm text-[var(--st-text-secondary)]">No comments yet.</p>
      ) : (
        comments.map((c) => (
          <Card key={c._id} className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
              <span>
                {c.authorId.slice(-6)} ·{' '}
                {c.createdAt
                  ? new Date(c.createdAt).toLocaleString()
                  : 'just now'}
              </span>
              <button
                type="button"
                className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                onClick={() => remove(c._id)}
              >
                Delete
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-[var(--st-text)]">
              {c.body}
            </pre>
            {c.attachmentIds && c.attachmentIds.length > 0 ? (
              <div className="flex flex-wrap gap-1 text-xs text-[var(--st-text-secondary)]">
                {c.attachmentIds.length} attachment
                {c.attachmentIds.length === 1 ? '' : 's'}
              </div>
            ) : null}
          </Card>
        ))
      )}
    </div>
  );
}

function HistoryTab({ entries }: { entries: BugHistoryEntryDoc[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-[var(--st-text-secondary)]">
        No history yet — changes are recorded as you edit the bug.
      </p>
    );
  }
  return (
    <Card className="flex flex-col gap-3 p-4">
      <ul className="flex flex-col gap-3">
        {entries.map((h) => (
          <li
            key={h._id}
            className="flex flex-col gap-1 border-l-2 border-[var(--st-border)] pl-3 text-sm"
          >
            <span className="text-xs text-[var(--st-text-secondary)]">
              {new Date(h.ts).toLocaleString()} · actor {h.actorId.slice(-6)}
            </span>
            <span className="text-[var(--st-text)]">
              <strong>{h.field}</strong> changed from{' '}
              <code className="rounded bg-[var(--st-bg-muted)] px-1">
                {formatHistoryValue(h.oldValue)}
              </code>{' '}
              to{' '}
              <code className="rounded bg-[var(--st-bg-muted)] px-1">
                {formatHistoryValue(h.newValue)}
              </code>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function formatHistoryValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function RelatedTab({ bugs }: { bugs: BugDoc[] }) {
  if (bugs.length === 0) {
    return (
      <p className="text-sm text-[var(--st-text-secondary)]">
        No related bugs found in the same project.
      </p>
    );
  }
  return (
    <Card className="flex flex-col gap-2 p-4">
      <ul className="flex flex-col gap-2">
        {bugs.map((b) => (
          <li
            key={b._id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <Link
              href={`/dashboard/sabbugs/${b._id}`}
              className="font-medium text-[var(--st-text)] hover:underline"
            >
              {bugTitle(b)}
            </Link>
            <span className="flex items-center gap-1">
              <BugStatusBadge status={b.status} />
              <BugSeverityBadge severity={b.severity} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
