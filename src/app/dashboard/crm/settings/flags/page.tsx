'use client';

import { ZoruBadge } from '@/components/zoruui';
import {
  Flag } from 'lucide-react';
import { HrEntityPage } from '../../_components/hr-entity-page';
import { RowDrawer } from '@/components/crm/row-drawer';

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
            <ZoruBadge variant="ghost">{String(row.resource_type || '')}</ZoruBadge>
          ),
        },
        {
          key: 'resource_id',
          label: 'Resource ID',
          render: (row) => (
            <RowDrawer
              label={String(row.resource_id || '')}
              subtitle={String(row.resource_type || '')}
              title={`Flag · ${String(row.resource_id || '')}`}
              description="Use the row Edit action to change this flag."
            >
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Module</div>
                  <div>{String(row.resource_type || '—')}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Resource ID</div>
                  <div className="font-mono">{String(row.resource_id || '—')}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Reason</div>
                  <div className="whitespace-pre-wrap">{String(row.reason || '—')}</div>
                </div>
                <p className="text-muted-foreground text-xs">
                  Edit and delete are available from the row actions.
                </p>
              </div>
            </RowDrawer>
          ),
        },
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
