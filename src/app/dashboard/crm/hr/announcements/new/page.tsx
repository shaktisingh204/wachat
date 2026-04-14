'use client';

import { Megaphone } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { saveAnnouncement } from '@/app/actions/hr.actions';
import { fields, sections } from '../_config';

export default function NewAnnouncementPage() {
  return (
    <HrFormPage
      title="New Announcement"
      subtitle="Create a company-wide update or pinned message."
      icon={Megaphone}
      backHref="/dashboard/crm/hr/announcements"
      singular="Announcement"
      fields={fields}
      sections={sections}
      saveAction={saveAnnouncement}
    />
  );
}
