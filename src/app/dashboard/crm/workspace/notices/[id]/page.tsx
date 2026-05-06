'use client';
import { ZoruBadge, ZoruButton, ZoruCard } from '@/components/zoruui';
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Megaphone, Pin, LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  getNoticeById,
  markNoticeViewed,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsNotice } from '@/lib/worksuite/knowledge-types';

export default function NoticeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [notice, setNotice] = React.useState<(WsNotice & { _id: string }) | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        const n = await getNoticeById(id);
        if (active) setNotice(n as any);
        // Auto-mark as viewed on mount.
        await markNoticeViewed(id);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex w-full items-center justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="flex w-full flex-col gap-4">
        <CrmPageHeader title="Notice" subtitle="Not found" icon={Megaphone} />
        <ZoruCard>
          <p className="text-center text-[13px] text-muted-foreground">Notice not found.</p>
        </ZoruCard>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={notice.heading}
        subtitle="Notice"
        icon={Megaphone}
        actions={
          <Link href="/dashboard/crm/workspace/notices">
            <ZoruButton variant="outline">
              Back
            </ZoruButton>
          </Link>
        }
      />
      <ZoruCard>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <ZoruBadge variant="ghost" className="capitalize">{notice.notice_to}</ZoruBadge>
          {notice.pinned ? (
            <ZoruBadge variant="ghost">
              <Pin className="h-3 w-3" /> Pinned
            </ZoruBadge>
          ) : null}
        </div>
        <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
          {notice.description}
        </div>
      </ZoruCard>
    </div>
  );
}
