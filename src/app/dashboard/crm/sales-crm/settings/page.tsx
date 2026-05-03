'use client';

import { Settings2 } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import {
  getLeadSettings,
  saveLeadSetting,
  deleteLeadSetting,
} from '@/app/actions/worksuite/crm-plus.actions';
import type { WsLeadSetting } from '@/lib/worksuite/crm-types';

export default function LeadSettingsPage() {
  return (
    <HrEntityPage<WsLeadSetting & { _id: string }>
      title="Lead Capture Settings"
      subtitle="Company profile, logo, and public share URLs for lead forms."
      icon={Settings2}
      singular="Setting"
      getAllAction={getLeadSettings as any}
      saveAction={saveLeadSetting}
      deleteAction={deleteLeadSetting}
      columns={[
        { key: 'company_name', label: 'Company' },
        { key: 'form_id', label: 'Form ID' },
        {
          key: 'share_link',
          label: 'Share Link',
          render: (row) =>
            row.share_link ? (
              <a
                href={String(row.share_link)}
                target="_blank"
                rel="noreferrer"
                className="text-accent-foreground underline"
              >
                open
              </a>
            ) : (
              '—'
            ),
        },
      ]}
      fields={[
        { name: 'company_name', label: 'Company Name', required: true, fullWidth: true },
        { name: 'form_id', label: 'Form ID (Mongo ObjectId)' },
        { name: 'logo', label: 'Logo URL', fullWidth: true },
        { name: 'default_url', label: 'Redirect URL', fullWidth: true },
        { name: 'share_link', label: 'Public Share Link', fullWidth: true },
      ]}
    />
  );
}
