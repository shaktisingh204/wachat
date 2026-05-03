'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  MessagesSquare,
  LoaderCircle,
  Send,
} from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  getDiscussionById,
  getDiscussionReplies,
  addDiscussionReply,
  deleteDiscussionReply,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
  WsDiscussion,
  WsDiscussionReply,
} from '@/lib/worksuite/knowledge-types';

function fmt(v: unknown) {
  if (!v) return '';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export default function DiscussionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { toast } = useToast();
  const [discussion, setDiscussion] = React.useState<
    (WsDiscussion & { _id: string }) | null
  >(null);
  const [replies, setReplies] = React.useState<(WsDiscussionReply & { _id: string })[]>([]);
  const [body, setBody] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!id) return;
    const [d, r] = await Promise.all([
      getDiscussionById(id),
      getDiscussionReplies(id),
    ]);
    setDiscussion(d as any);
    setReplies(r as any);
  }, [id]);

  React.useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !body.trim()) return;
    setSubmitting(true);
    const res = await addDiscussionReply(id, body);
    setSubmitting(false);
    if (res.success) {
      setBody('');
      refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  const handleDeleteReply = async (rid: string) => {
    const r = await deleteDiscussionReply(rid);
    if (r.success) refresh();
    else toast({ title: 'Error', description: r.error, variant: 'destructive' });
  };

  if (loading) {
    return (
      <div className="flex w-full items-center justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!discussion) {
    return (
      <div className="flex w-full flex-col gap-4">
        <CrmPageHeader title="Discussion" subtitle="Not found" icon={MessagesSquare} />
        <ClayCard><p className="text-center text-[13px] text-muted-foreground">Discussion not found.</p></ClayCard>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={discussion.title}
        subtitle="Discussion"
        icon={MessagesSquare}
        actions={
          <Link href="/dashboard/crm/workspace/discussions">
            <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />}>
              Back
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
          {discussion.description || 'No description.'}
        </p>
      </ClayCard>

      <ClayCard>
        <h3 className="mb-3 text-[14px] font-semibold text-foreground">
          Replies ({replies.length})
        </h3>
        <div className="flex flex-col gap-3">
          {replies.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No replies yet — be the first.</p>
          ) : (
            replies.map((r) => (
              <ClayCard key={r._id} variant="soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-foreground">{r.user_name || r.user_id}</p>
                    <p className="text-[11px] text-muted-foreground">{fmt(r.createdAt)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13.5px] text-foreground">{r.body}</p>
                  </div>
                  <ClayButton variant="ghost" size="sm" onClick={() => handleDeleteReply(r._id)}>
                    Delete
                  </ClayButton>
                </div>
              </ClayCard>
            ))
          )}
        </div>
      </ClayCard>

      <ClayCard>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a reply…"
            rows={3}
          />
          <div className="flex justify-end">
            <ClayButton
              type="submit"
              variant="obsidian"
              disabled={submitting || !body.trim()}
              leading={
                submitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" strokeWidth={1.75} />
                )
              }
            >
              Post reply
            </ClayButton>
          </div>
        </form>
      </ClayCard>
    </div>
  );
}
