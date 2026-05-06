'use client';
import { ZoruBadge, ZoruButton, ZoruCard, useZoruToast } from '@/components/zoruui';
import * as React from 'react';
import Link from 'next/link';
import { Megaphone, Plus, Pin, Eye, EyeOff, LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';

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
  const { toast } = useZoruToast();
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
            <ZoruButton>
              New Notice
            </ZoruButton>
          </Link>
        }
      />

      {loading ? (
        <ZoruCard className="flex items-center justify-center py-10">
          <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
        </ZoruCard>
      ) : sorted.length === 0 ? (
        <ZoruCard>
          <p className="text-center text-[13px] text-muted-foreground">
            No notices yet — click New Notice to publish your first.
          </p>
        </ZoruCard>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((n) => {
            const viewed = viewedSet.has(n._id);
            return (
              <ZoruCard key={n._id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/crm/workspace/notices/${n._id}`}
                        className="text-[14.5px] font-semibold text-foreground hover:underline"
                      >
                        {n.heading}
                      </Link>
                      {n.pinned ? (
                        <ZoruBadge variant="ghost">
                          <Pin className="h-3 w-3" /> Pinned
                        </ZoruBadge>
                      ) : null}
                      <ZoruBadge variant="ghost" className="capitalize">
                        {n.notice_to}
                      </ZoruBadge>
                      {viewed ? (
                        <ZoruBadge variant="success">
                          <Eye className="h-3 w-3" /> Viewed
                        </ZoruBadge>
                      ) : (
                        <ZoruBadge variant="warning">
                          <EyeOff className="h-3 w-3" /> Unread
                        </ZoruBadge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
                      {n.description}
                    </p>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      {fmtDate(n.createdAt)}
                    </p>
                  </div>
                  <ZoruButton variant="ghost" size="sm" onClick={() => handleDelete(n._id)}>
                    Delete
                  </ZoruButton>
                </div>
              </ZoruCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
