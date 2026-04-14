'use client';

import { Flag } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../../hr/_components/hr-entity-page';
import {
  getFlags,
  saveFlag,
  deleteFlag,
} from '@/app/actions/worksuite/meta.actions';
import type { WsFlag } from '@/lib/worksuite/meta-types';

/** Resource flags — moderator-style tagging of records that need attention. */
export default function FlagsPage() {
  return (
    <HrEntityPage<WsFlag & { _id: string }>
      title="Flags"
      subtitle="Flag records across modules that need follow-up or review."
      icon={Flag}
      singular="Flag"
      getAllAction={getFlags as any}
      saveAction={saveFlag}
      deleteAction={deleteFlag}
      columns={[
        {
          key: 'resource_type',
          label: 'Module',
          render: (row) => (
            <ClayBadge tone="rose-soft">{String(row.resource_type || '')}</ClayBadge>
          ),
        },
        { key: 'resource_id', label: 'Resource ID' },
        { key: 'reason', label: 'Reason' },
      ]}
      fields={[
        {
          name: 'resource_type',
          label: 'Module',
          type: 'select',
          required: true,
          options: [
            { value: 'contact', label: 'Contact' },
            { value: 'account', label: 'Account' },
            { value: 'deal', label: 'Deal' },
            { value: 'lead', label: 'Lead' },
            { value: 'task', label: 'Task' },
            { value: 'project', label: 'Project' },
            { value: 'invoice', label: 'Invoice' },
            { value: 'ticket', label: 'Ticket' },
          ],
        },
        { name: 'resource_id', label: 'Resource ID', required: true },
        { name: 'reason', label: 'Reason', type: 'textarea', fullWidth: true },
      ]}
    />
  );
}
