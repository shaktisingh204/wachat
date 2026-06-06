'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { History, Link2, MessageSquare, X } from 'lucide-react';

import {
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageActions,
  SegmentedControl,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
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
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Bug {bug._id.slice(-8)}</PageEyebrow>
          <PageTitle>{bugTitle(bug)}</PageTitle>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <BugStatusBadge status={bug.status} />
            <BugSeverityBadge severity={bug.severity} />
            <BugPriorityBadge priority={bug.priority} />
          </div>
        </PageHeaderHeading>
        <PageActions>
          <StatusActions bug={bug} />
        </PageActions>
      </PageHeader>

      <SegmentedControl<DetailTab>
        aria-label="Bug detail sections"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'comments', label: 'Comments' },
          { value: 'history', label: 'History' },
          { value: 'related', label: 'Related' },
        ]}
      />

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

function StatusActions({ bug }: { bug: BugDoc }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function setStatus(status: BugStatus) {
    setBusy(true);
    const res = await updateBug(bug._id, { status });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Status set to ${status}.`);
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
  const { toast } = useToast();
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
      toast.error(res.error);
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
      <Card className="flex flex-col gap-3">
        <Field label="Add a comment">
          <Textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a comment in markdown..."
          />
        </Field>
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
              className="inline-flex items-center gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-1 text-xs"
            >
              <code className="font-mono">{id.slice(-6)}</code>
              <IconButton
                label="Remove attachment"
                icon={X}
                size="sm"
                onClick={() =>
                  setAttachments((prev) => prev.filter((x) => x !== id))
                }
              />
            </span>
          ))}
          <span className="ml-auto" />
          <Button
            variant="primary"
            onClick={submit}
            loading={busy}
            disabled={!body.trim()}
          >
            Post comment
          </Button>
        </div>
      </Card>

      {comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments yet"
          description="Be the first to leave a note on this bug."
        />
      ) : (
        comments.map((c) => (
          <Card key={c._id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
              <span>
                {c.authorId.slice(-6)}{' '}
                {c.createdAt
                  ? new Date(c.createdAt).toLocaleString()
                  : 'just now'}
              </span>
              <Button variant="ghost" size="sm" onClick={() => remove(c._id)}>
                Delete
              </Button>
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
      <EmptyState
        icon={History}
        title="No history yet"
        description="Changes are recorded here as you edit the bug."
      />
    );
  }
  return (
    <Card className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {entries.map((h) => (
          <li
            key={h._id}
            className="flex flex-col gap-1 border-l-2 border-[var(--st-border)] pl-3 text-sm"
          >
            <span className="text-xs text-[var(--st-text-secondary)]">
              {new Date(h.ts).toLocaleString()} - actor {h.actorId.slice(-6)}
            </span>
            <span className="text-[var(--st-text)]">
              <strong>{h.field}</strong> changed from{' '}
              <code className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-1">
                {formatHistoryValue(h.oldValue)}
              </code>{' '}
              to{' '}
              <code className="rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-1">
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
  if (v == null) return '-';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function RelatedTab({ bugs }: { bugs: BugDoc[] }) {
  if (bugs.length === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="No related bugs"
        description="Nothing else in this project links to this bug."
      />
    );
  }
  return (
    <Card className="flex flex-col gap-2">
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
