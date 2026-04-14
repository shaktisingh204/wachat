import { AtSign } from 'lucide-react';

import { CrmPageHeader } from '../_components/crm-page-header';
import { ClayCard, ClayBadge } from '@/components/clay';
import { getMentionsForMe } from '@/app/actions/worksuite/chat.actions';
import type { WsMentionUser } from '@/lib/worksuite/chat-types';
import { MentionRow } from './_components/mention-row';

export default async function MentionsPage() {
  const mentions = (await getMentionsForMe()) as (WsMentionUser & { _id: string })[];
  const unread = mentions.filter((m) => !m.read_at).length;

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Mentions"
        subtitle="Every time someone @-mentions you."
        icon={AtSign}
        actions={
          unread > 0 ? (
            <ClayBadge tone="rose">{unread} unread</ClayBadge>
          ) : null
        }
      />

      {mentions.length === 0 ? (
        <ClayCard className="flex items-center justify-center py-12">
          <p className="text-[13px] text-clay-ink-muted">No mentions yet.</p>
        </ClayCard>
      ) : (
        <ClayCard padded={false}>
          <ul className="divide-y divide-clay-border">
            {mentions.map((m) => (
              <MentionRow key={m._id} mention={m} />
            ))}
          </ul>
        </ClayCard>
      )}
    </div>
  );
}
