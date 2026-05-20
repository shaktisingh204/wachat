'use client';

/**
 * Flags settings — §1D.4 bar:
 *  - KPI strip (Total · by module count · unique modules)
 *  - Search across resource_id / reason
 *  - Filter chips: All + per-module
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog
 *  - RowDrawer on resource_id
 */

import * as React from 'react';
import { Flag, Tag, Hash } from 'lucide-react';
import { ZoruBadge } from '@/components/zoruui';

import { RowDrawer } from '@/components/crm/row-drawer';
import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import {
  getFlags,
  saveFlag,
  deleteFlag,
} from '@/app/actions/worksuite/meta.actions';
import type { WsFlag } from '@/lib/worksuite/meta-types';

type Row = WsFlag & { _id: string };

type ModuleFilter = 'all' | string;

const MODULE_OPTIONS = [
  { value: 'contact', label: 'Contact' },
  { value: 'account', label: 'Account' },
  { value: 'deal', label: 'Deal' },
  { value: 'lead', label: 'Lead' },
  { value: 'task', label: 'Task' },
  { value: 'project', label: 'Project' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'ticket', label: 'Ticket' },
];

export default function FlagsPage() {
  const [moduleFilter, setModuleFilter] = React.useState<ModuleFilter>('all');

  const getAll = React.useCallback(async () => {
    const list = (await getFlags()) as Row[];
    if (moduleFilter !== 'all') {
      return list.filter((f) => f.resource_type === moduleFilter);
    }
    return list;
  }, [moduleFilter]);

  return (
    <SettingsEntityShell<Row>
      title="Flags"
      subtitle="Flag records across modules that need follow-up or review."
      singular="Flag"
      getAllAction={getAll}
      saveAction={saveFlag}
      deleteAction={deleteFlag}
      csvFilename="flags"
      kpis={(_rows, all) => {
        const uniqueModules = new Set(all.map((f) => f.resource_type).filter(Boolean)).size;
        return [
          {
            label: 'Total',
            value: all.length,
            icon: <Flag className="h-4 w-4" />,
            filterKey: 'all',
            active: moduleFilter === 'all',
          },
          {
            label: 'Modules covered',
            value: uniqueModules,
            icon: <Tag className="h-4 w-4" />,
          },
          {
            label: 'With reason',
            value: all.filter((f) => (f.reason || '').trim().length > 0).length,
            icon: <Hash className="h-4 w-4" />,
          },
        ];
      }}
      onKpiClick={(k) => setModuleFilter(k)}
      filterChips={[
        { key: 'all', label: 'All', active: moduleFilter === 'all' },
        ...MODULE_OPTIONS.map((m) => ({
          key: m.value,
          label: m.label,
          active: moduleFilter === m.value,
        })),
      ]}
      onFilterChange={(k) => setModuleFilter(k)}
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
          options: MODULE_OPTIONS,
        },
        { name: 'resource_id', label: 'Resource ID', required: true },
        { name: 'reason', label: 'Reason', type: 'textarea', fullWidth: true },
      ]}
    />
  );
}
