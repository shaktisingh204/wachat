'use client';

/**
 * SabCRM — threaded comments + @mentions panel for the record detail surface.
 *
 * Mounted as a tab on `/sabcrm/[objectSlug]/[recordId]` (see the wiring snippet
 * in the vertical's return value). Renders a record's comment thread (roots →
 * one-level replies) with a mention-aware composer that reuses the repo's
 * existing `<MentionTextarea>` (`src/components/crm/mention-textarea.tsx`,
 * token format `@[Name](user:ID)`). Posting fans out mention notifications to
 * the inbox via the gated `addCommentTw` action.
 *
 * Pure 20ui + lucide-via-renderIcon. Auth/RBAC/project/plan are enforced by the
 * gated actions (this is a pure consumer); the panel degrades to loading /
 * empty / error and never crashes when the engine is unreachable. Mention HTML
 * is rendered through `renderCommentHtml` (escape-then-linkify) so author text
 * can never inject markup.
 */

import * as React from 'react';
import { MessageSquare, Reply, Trash2, Send, X } from 'lucide-react';

import {
  Card,
  Button,
  IconButton,
  Avatar,
  Alert,
  EmptyState,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import { renderIcon } from '@/components/sabcrm/20ui/_icon';
import { useProject } from '@/context/project-context';
import {
  MentionTextarea,
  type MentionUser,
} from '@/components/crm/mention-textarea';
import {
  listCommentsTw,
  addCommentTw,
  deleteCommentTw,
} from '@/app/actions/sabcrm-comments.actions';
import {
  renderCommentHtml,
  type CrmComment,
  type CommentMember,
  type CommentNode,
} from '@/lib/sabcrm/comments';

export interface CommentsPanelProps {
  /** Object slug of the record the thread is attached to. */
  object: string;
  /** Id of the record the thread is attached to. */
  recordId: string;
  /**
   * The viewing user's id, when known. Drives the "delete" affordance (only
   * shown on the viewer's own comments — the server independently enforces
   * authorship, so this is purely a UX nicety) and the "you" highlight.
   */
  currentUserId?: string;
  /** Optional project override; defaults to the active project. */
  projectId?: string;
}

/* ----------------------------- time formatting ---------------------------- */

/** Compact relative time ("just now", "5m", "3h", "2d", else a date). */
function relativeTime(iso: string, nowMs: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diff = Math.max(0, nowMs - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(t).toLocaleDateString();
}

/* ------------------------------- composer --------------------------------- */

interface ComposerProps {
  members: MentionUser[];
  placeholder: string;
  submitLabel: string;
  busy: boolean;
  autoFocus?: boolean;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
}

function Composer({
  members,
  placeholder,
  submitLabel,
  busy,
  autoFocus,
  onSubmit,
  onCancel,
}: ComposerProps): React.JSX.Element {
  const [value, setValue] = React.useState('');
  const canSend = value.trim().length > 0 && !busy;

  function submit(): void {
    if (!canSend) return;
    onSubmit(value.trim());
    setValue('');
  }

  return (
    <div className="flex flex-col gap-[var(--st-space-2)]">
      <MentionTextarea
        value={value}
        onChange={setValue}
        users={members}
        rows={3}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <div className="flex items-center justify-end gap-[var(--st-space-2)]">
        {onCancel ? (
          <Button variant="ghost" size="sm" iconLeft={X} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          iconLeft={Send}
          onClick={submit}
          loading={busy}
          disabled={!canSend}
        >
          {submitLabel}
        </Button>
      </div>
      {members.length === 0 ? (
        <p className="text-[12px] text-[var(--st-text-secondary)]">
          Type @ to mention a teammate once members load.
        </p>
      ) : null}
    </div>
  );
}

/* ----------------------------- single comment ----------------------------- */

interface CommentRowProps {
  comment: CrmComment;
  members: CommentMember[];
  memberById: Map<string, CommentMember>;
  nowMs: number;
  currentUserId?: string;
  isReply?: boolean;
  onReply?: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  deleting: boolean;
}

function CommentRow({
  comment,
  members,
  memberById,
  nowMs,
  currentUserId,
  isReply,
  onReply,
  onDelete,
  deleting,
}: CommentRowProps): React.JSX.Element {
  const author = memberById.get(comment.authorId);
  const authorName = author?.name ?? 'Unknown';
  const isMine = !!currentUserId && comment.authorId === currentUserId;
  const html = React.useMemo(
    () => renderCommentHtml(comment.body, members),
    [comment.body, members],
  );

  return (
    <div className={isReply ? 'flex gap-[var(--st-space-2)]' : 'flex gap-[var(--st-space-2)]'}>
      <Avatar
        name={authorName}
        src={author?.avatarUrl}
        size={isReply ? 'sm' : 'md'}
        shape="round"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-[var(--st-space-2)]">
          <span className="text-[13px] font-medium text-[var(--st-text)]">
            {authorName}
            {isMine ? (
              <span className="ml-1 text-[var(--st-text-secondary)]">(you)</span>
            ) : null}
          </span>
          <span className="text-[12px] text-[var(--st-text-secondary)]">
            {relativeTime(comment.createdAt, nowMs)}
          </span>
        </div>
        <div
          className="sabcrm-comment-body mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[var(--st-text)]"
          // Safe: `renderCommentHtml` HTML-escapes the body first, then emits
          // only a fixed, attribute-escaped <span> per mention token.
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <div className="mt-1 flex items-center gap-1">
          {onReply ? (
            <button
              type="button"
              onClick={() => onReply(comment._id)}
              className="inline-flex items-center gap-1 rounded-[var(--st-radius-sm)] px-1.5 py-0.5 text-[12px] text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]"
            >
              {renderIcon(Reply, { size: 13 })}
              Reply
            </button>
          ) : null}
          {isMine ? (
            <IconButton
              icon={Trash2}
              label="Delete comment"
              variant="ghost"
              size="sm"
              disabled={deleting}
              onClick={() => onDelete(comment._id)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- panel ----------------------------------- */

export function CommentsPanel({
  object,
  recordId,
  currentUserId,
  projectId,
}: CommentsPanelProps): React.JSX.Element {
  const { activeProjectId } = useProject();
  const { toast } = useToast();
  const effectiveProjectId = projectId ?? activeProjectId ?? undefined;

  const [nodes, setNodes] = React.useState<CommentNode[]>([]);
  const [members, setMembers] = React.useState<CommentMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [posting, setPosting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [replyTo, setReplyTo] = React.useState<string | null>(null);

  const nowMs = Date.now();

  const memberById = React.useMemo(() => {
    const m = new Map<string, CommentMember>();
    for (const x of members) m.set(x.userId, x);
    return m;
  }, [members]);

  const mentionUsers = React.useMemo<MentionUser[]>(
    () =>
      members.map((m) => ({
        id: m.userId,
        name: m.name,
        avatar: m.avatarUrl,
      })),
    [members],
  );

  const load = React.useCallback(async () => {
    if (!object || !recordId) return;
    setLoading(true);
    setError(null);
    const res = await listCommentsTw(object, recordId, effectiveProjectId);
    if (res.ok) {
      setNodes(res.data.nodes);
      setMembers(res.data.members);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [object, recordId, effectiveProjectId]);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      if (!object || !recordId) return;
      setLoading(true);
      setError(null);
      const res = await listCommentsTw(object, recordId, effectiveProjectId);
      if (!alive) return;
      if (res.ok) {
        setNodes(res.data.nodes);
        setMembers(res.data.members);
      } else {
        setError(res.error);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [object, recordId, effectiveProjectId]);

  async function post(body: string, parentId?: string | null): Promise<void> {
    setPosting(true);
    const res = await addCommentTw(
      { object, recordId, body, parentId: parentId ?? null },
      effectiveProjectId,
    );
    setPosting(false);
    if (!res.ok) {
      toast({ title: 'Could not post comment', description: res.error, tone: 'danger' });
      return;
    }
    setReplyTo(null);
    const n = res.data.notified.length;
    toast({
      title: parentId ? 'Reply posted' : 'Comment posted',
      description: n > 0 ? `${n} ${n === 1 ? 'person was' : 'people were'} notified.` : undefined,
      tone: 'success',
    });
    await load();
  }

  async function remove(id: string): Promise<void> {
    setDeletingId(id);
    const res = await deleteCommentTw(id, effectiveProjectId);
    setDeletingId(null);
    if (!res.ok) {
      toast({ title: 'Could not delete', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: 'Comment deleted', tone: 'success' });
    await load();
  }

  return (
    <div className="flex flex-col gap-[var(--st-space-4)]">
      <Card className="p-[var(--st-space-4)]">
        <Composer
          members={mentionUsers}
          placeholder="Write a comment… use @ to mention a teammate"
          submitLabel="Comment"
          busy={posting && replyTo === null}
          onSubmit={(body) => void post(body, null)}
        />
      </Card>

      {error ? (
        <Alert tone="danger" title="Could not load comments">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-[var(--st-space-3)]">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : nodes.length === 0 && !error ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments yet"
          description="Start the conversation. Mention teammates with @ to notify them."
        />
      ) : (
        <div className="flex flex-col gap-[var(--st-space-4)]">
          {nodes.map((root) => (
            <Card key={root._id} className="p-[var(--st-space-4)]">
              <CommentRow
                comment={root}
                members={members}
                memberById={memberById}
                nowMs={nowMs}
                currentUserId={currentUserId}
                onReply={(id) => setReplyTo((cur) => (cur === id ? null : id))}
                onDelete={(id) => void remove(id)}
                deleting={deletingId === root._id}
              />

              {root.replies.length > 0 ? (
                <div className="mt-[var(--st-space-3)] flex flex-col gap-[var(--st-space-3)] border-l border-[var(--st-border)] pl-[var(--st-space-3)]">
                  {root.replies.map((reply) => (
                    <CommentRow
                      key={reply._id}
                      comment={reply}
                      members={members}
                      memberById={memberById}
                      nowMs={nowMs}
                      currentUserId={currentUserId}
                      isReply
                      onDelete={(id) => void remove(id)}
                      deleting={deletingId === reply._id}
                    />
                  ))}
                </div>
              ) : null}

              {replyTo === root._id ? (
                <div className="mt-[var(--st-space-3)] border-t border-[var(--st-border)] pt-[var(--st-space-3)]">
                  <Composer
                    members={mentionUsers}
                    placeholder={`Reply to ${
                      memberById.get(root.authorId)?.name ?? 'this comment'
                    }…`}
                    submitLabel="Reply"
                    busy={posting && replyTo === root._id}
                    autoFocus
                    onSubmit={(body) => void post(body, root._id)}
                    onCancel={() => setReplyTo(null)}
                  />
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default CommentsPanel;
