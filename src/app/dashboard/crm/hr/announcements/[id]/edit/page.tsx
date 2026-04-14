'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import { getAnnouncements, saveAnnouncement } from '@/app/actions/hr.actions';
import type { HrAnnouncement } from '@/lib/hr-types';
import { fields, sections } from '../../_config';

export default function EditAnnouncementPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = React.useState<
    (HrAnnouncement & { _id: string }) | null
  >(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getAnnouncements()) as (HrAnnouncement & {
          _id: string;
        })[];
        const found = Array.isArray(list)
          ? list.find((r) => String(r._id) === String(id)) || null
          : null;
        if (active) setRecord(found);
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
      <div className="p-6 text-[13px] text-clay-ink-muted">Loading…</div>
    );
  }

  return (
    <HrFormPage
      title="Edit Announcement"
      subtitle="Update announcement details."
      icon={Megaphone}
      backHref="/dashboard/crm/hr/announcements"
      singular="Announcement"
      fields={fields}
      sections={sections}
      saveAction={saveAnnouncement}
      initial={record as unknown as Record<string, unknown>}
    />
  );
}
