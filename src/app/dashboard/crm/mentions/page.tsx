import { ZoruBadge, ZoruCard, ZoruPageActions, ZoruPageDescription, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import {
  AtSign } from 'lucide-react';

import { getMentionsForMe } from '@/app/actions/worksuite/chat.actions';
import type { WsMentionUser } from '@/lib/worksuite/chat-types';
import { MentionRow } from './_components/mention-row';

export default async function MentionsPage() {
  const mentions = (await getMentionsForMe()) as (WsMentionUser & { _id: string })[];
  const unread = mentions.filter((m) => !m.read_at).length;

  return (
    <div className="flex w-full flex-col gap-6">
      <ZoruPageHeader>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
            <AtSign className="h-5 w-5 text-zoru-ink" strokeWidth={1.75} />
          </div>
          <ZoruPageHeading>
            <ZoruPageTitle>Mentions</ZoruPageTitle>
            <ZoruPageDescription>Every time someone @-mentions you.</ZoruPageDescription>
          </ZoruPageHeading>
        </div>
        {unread > 0 ? (
          <ZoruPageActions>
            <ZoruBadge variant="danger">{unread} unread</ZoruBadge>
          </ZoruPageActions>
        ) : null}
      </ZoruPageHeader>

      {mentions.length === 0 ? (
        <ZoruCard className="flex items-center justify-center p-6 py-12">
          <p className="text-[13px] text-zoru-ink-muted">No mentions yet.</p>
        </ZoruCard>
      ) : (
        <ZoruCard className="p-0">
          <ul className="divide-y divide-zoru-line">
            {mentions.map((m) => (
              <MentionRow key={m._id} mention={m} />
            ))}
          </ul>
        </ZoruCard>
      )}
    </div>
  );
}
