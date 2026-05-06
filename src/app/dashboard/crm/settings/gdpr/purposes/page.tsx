'use client';

import { ListChecks } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../../_components/hr-entity-page';
import {
  getPurposeConsents,
  savePurposeConsent,
  deletePurposeConsent,
} from '@/app/actions/worksuite/gdpr.actions';
import type { WsPurposeConsent } from '@/lib/worksuite/gdpr-types';

/**
 * Purpose Consents — tenant-defined processing purposes that leads or
 * users can grant/revoke consent for. Mirrors Worksuite's
 * `/gdpr/purpose-consent` screen.
 */
export default function PurposeConsentsPage() {
  return (
    <HrEntityPage<WsPurposeConsent & { _id: string }>
      title="Purpose Consents"
      subtitle="Processing purposes leads and users can grant or revoke consent for."
      icon={ListChecks}
      singular="Purpose"
      getAllAction={getPurposeConsents as any}
      saveAction={savePurposeConsent}
      deleteAction={deletePurposeConsent}
      columns={[
        { key: 'title', label: 'Title' },
        {
          key: 'applies_to',
          label: 'Applies to',
          render: (row) => (
            <ClayBadge tone="neutral">
              {row.applies_to
                ? row.applies_to.charAt(0).toUpperCase() +
                  row.applies_to.slice(1)
                : 'Both'}
            </ClayBadge>
          ),
        },
        {
          key: 'is_required',
          label: 'Required',
          render: (row) => (
            <ClayBadge tone={row.is_required ? 'amber' : 'neutral'}>
              {row.is_required ? 'Required' : 'Optional'}
            </ClayBadge>
          ),
        },
        {
          key: 'is_active',
          label: 'Status',
          render: (row) => (
            <ClayBadge tone={row.is_active ? 'green' : 'neutral'}>
              {row.is_active ? 'Active' : 'Inactive'}
            </ClayBadge>
          ),
        },
        {
          key: 'sort_order',
          label: 'Order',
          render: (row) => String(row.sort_order ?? 0),
        },
      ]}
      fields={[
        {
          name: 'title',
          label: 'Title',
          required: true,
          placeholder: 'Marketing communications',
          fullWidth: true,
        },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          placeholder:
            'We process your data to send product updates and newsletters.',
          fullWidth: true,
        },
        {
          name: 'applies_to',
          label: 'Applies to',
          type: 'select',
          options: [
            { value: 'both', label: 'Both leads and users' },
            { value: 'lead', label: 'Leads only' },
            { value: 'user', label: 'Users only' },
          ],
          defaultValue: 'both',
        },
        {
          name: 'sort_order',
          label: 'Sort order',
          type: 'number',
          defaultValue: '0',
        },
        {
          name: 'is_required',
          label: 'Required',
          type: 'select',
          options: [
            { value: 'false', label: 'Optional' },
            { value: 'true', label: 'Required' },
          ],
          defaultValue: 'false',
        },
        {
          name: 'is_active',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ],
          defaultValue: 'true',
        },
      ]}
    />
  );
}
