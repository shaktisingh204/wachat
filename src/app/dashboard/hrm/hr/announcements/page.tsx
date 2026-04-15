'use client';

import { Megaphone } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getAnnouncements,
  saveAnnouncement,
  deleteAnnouncement,
} from '@/app/actions/hr.actions';
import type { HrAnnouncement } from '@/lib/hr-types';
import { fields } from './_config';

function formatDate(value: unknown) {
  if (!value) return '—';
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

export default function AnnouncementsPage() {
  return (
    <HrEntityPage<HrAnnouncement & { _id: string }>
      title="Announcements"
      subtitle="Company-wide updates, news, and pinned messages."
      icon={Megaphone}
      singular="Announcement"
      basePath="/dashboard/hrm/hr/announcements"
      getAllAction={getAnnouncements as any}
      saveAction={saveAnnouncement}
      deleteAction={deleteAnnouncement}
      columns={[
        { key: 'title', label: 'Title' },
        {
          key: 'audience',
          label: 'Audience',
          render: (row) => (
            <ClayBadge tone="rose-soft">{row.audience || 'all'}</ClayBadge>
          ),
        },
        {
          key: 'publishAt',
          label: 'Publish At',
          render: (row) => <span>{formatDate(row.publishAt)}</span>,
        },
        {
          key: 'pinned',
          label: 'Pinned',
          render: (row) => {
            const isPinned =
              row.pinned === true ||
              (row.pinned as unknown as string) === 'yes' ||
              (row.pinned as unknown as string) === 'true';
            return (
              <ClayBadge tone={isPinned ? 'amber' : 'neutral'}>
                {isPinned ? 'Yes' : 'No'}
              </ClayBadge>
            );
          },
        },
      ]}
      fields={fields}
    />
  );
}
