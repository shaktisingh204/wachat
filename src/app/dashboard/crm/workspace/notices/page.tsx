'use client';

import * as React from 'react';
import Link from 'next/link';
import { Megaphone, Plus, Pin, Eye, EyeOff, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  getNotices,
  getNoticeViewsForUser,
  deleteNotice,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsNotice, WsNoticeView } from '@/lib/worksuite/knowledge-types';

function fmtDate(v: unknown) {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function NoticesPage() {
  const { toast } = useToast();
  const [notices, setNotices] = React.useState<(WsNotice & { _id: string })[]>([]);
  const [views, setViews] = React.useState<WsNoticeView[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [n, v] = await Promise.all([getNotices(), getNoticeViewsForUser()]);
      setNotices(n as any);
      setViews(v as any);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const viewedSet = React.useMemo(
    () => new Set(views.map((v) => v.notice_id)),
    [views],
  );

  const sorted = React.useMemo(
    () =>
      [...notices].sort((a, b) => {
        const ap = a.pinned ? 1 : 0;
        const bp = b.pinned ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }),
    [notices],
  );

  const handleDelete = async (id: string) => {
    const r = await deleteNotice(id);
    if (r.success) {
      toast({ title: 'Deleted', description: 'Notice removed.' });
      refresh();
    } else toast({ title: 'Error', description: r.error, variant: 'destructive' });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Notices"
        subtitle="Company-wide notices with read tracking."
        icon={Megaphone}
        actions={
          <Link href="/dashboard/crm/workspace/notices/new">
            <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
              New Notice
            </ClayButton>
          </Link>
        }
      />

      {loading ? (
        <ClayCard className="flex items-center justify-center py-10">
          <LoaderCircle className="h-5 w-5 animate-spin text-clay-ink-muted" />
        </ClayCard>
      ) : sorted.length === 0 ? (
        <ClayCard>
          <p className="text-center text-[13px] text-clay-ink-muted">
            No notices yet — click New Notice to publish your first.
          </p>
        </ClayCard>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((n) => {
            const viewed = viewedSet.has(n._id);
            return (
              <ClayCard key={n._id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/crm/workspace/notices/${n._id}`}
                        className="text-[14.5px] font-semibold text-clay-ink hover:underline"
                      >
                        {n.heading}
                      </Link>
                      {n.pinned ? (
                        <ClayBadge tone="rose-soft">
                          <Pin className="h-3 w-3" /> Pinned
                        </ClayBadge>
                      ) : null}
                      <ClayBadge tone="neutral" className="capitalize">
                        {n.notice_to}
                      </ClayBadge>
                      {viewed ? (
                        <ClayBadge tone="green">
                          <Eye className="h-3 w-3" /> Viewed
                        </ClayBadge>
                      ) : (
                        <ClayBadge tone="amber">
                          <EyeOff className="h-3 w-3" /> Unread
                        </ClayBadge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] text-clay-ink-muted">
                      {n.description}
                    </p>
                    <p className="mt-1 text-[11.5px] text-clay-ink-muted">
                      {fmtDate(n.createdAt)}
                    </p>
                  </div>
                  <ClayButton variant="ghost" size="sm" onClick={() => handleDelete(n._id)}>
                    Delete
                  </ClayButton>
                </div>
              </ClayCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
