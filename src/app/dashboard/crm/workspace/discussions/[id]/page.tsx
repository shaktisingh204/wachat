'use client';
import { ZoruButton, ZoruCard, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  MessagesSquare,
  LoaderCircle,
  Send,
} from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';

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
  const { toast } = useZoruToast();
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
        <ZoruCard><p className="text-center text-[13px] text-muted-foreground">Discussion not found.</p></ZoruCard>
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
            <ZoruButton variant="outline">
              Back
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard>
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
          {discussion.description || 'No description.'}
        </p>
      </ZoruCard>

      <ZoruCard>
        <h3 className="mb-3 text-[14px] font-semibold text-foreground">
          Replies ({replies.length})
        </h3>
        <div className="flex flex-col gap-3">
          {replies.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No replies yet — be the first.</p>
          ) : (
            replies.map((r) => (
              <ZoruCard key={r._id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-foreground">{r.user_name || r.user_id}</p>
                    <p className="text-[11px] text-muted-foreground">{fmt(r.createdAt)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13.5px] text-foreground">{r.body}</p>
                  </div>
                  <ZoruButton variant="ghost" size="sm" onClick={() => handleDeleteReply(r._id)}>
                    Delete
                  </ZoruButton>
                </div>
              </ZoruCard>
            ))
          )}
        </div>
      </ZoruCard>

      <ZoruCard>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <ZoruTextarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a reply…"
            rows={3}
          />
          <div className="flex justify-end">
            <ZoruButton
              type="submit"
             
              disabled={submitting || !body.trim()}
             
            >
              Post reply
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
