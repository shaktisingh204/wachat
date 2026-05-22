'use client';

/**
 * Custom Field Groups — §1D.4 bar:
 *  - KPI strip (Total groups · Distinct entity types)
 *  - Search across name / belongs_to
 *  - Filter chips: All + per entity type
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog
 *  - RowDrawer on name
 */

import * as React from 'react';
import { FolderTree, Layers, Tag } from 'lucide-react';
import { Badge } from '@/components/zoruui';

import { RowDrawer } from '@/components/crm/row-drawer';
import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import {
  getCustomFieldGroups,
  saveCustomFieldGroup,
  deleteCustomFieldGroup,
} from '@/app/actions/worksuite/meta.actions';
import type { WsCustomFieldGroup } from '@/lib/worksuite/meta-types';

type Row = WsCustomFieldGroup & { _id: string };

const ENTITY_OPTIONS = [
  { value: 'contact', label: 'Contact' },
  { value: 'account', label: 'Account' },
  { value: 'client', label: 'Client' },
  { value: 'deal', label: 'Deal' },
  { value: 'lead', label: 'Lead' },
  { value: 'task', label: 'Task' },
  { value: 'project', label: 'Project' },
  { value: 'employee', label: 'Employee' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'product', label: 'Product' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'expense', label: 'Expense' },
];

type EntityFilter = 'all' | string;

export default function CustomFieldGroupsPage() {
  const [entityFilter, setEntityFilter] = React.useState<EntityFilter>('all');

  const getAll = React.useCallback(async () => {
    const list = (await getCustomFieldGroups()) as Row[];
    if (entityFilter !== 'all') {
      return list.filter((g) => g.belongs_to === entityFilter);
    }
    return list;
  }, [entityFilter]);

  return (
    <SettingsEntityShell<Row>
      title="Custom Field Groups"
      subtitle="Each group attaches a set of custom fields to one target module."
      singular="Group"
      getAllAction={getAll}
      saveAction={saveCustomFieldGroup}
      deleteAction={deleteCustomFieldGroup}
      csvFilename="custom-field-groups"
      kpis={(_rows, all) => {
        const distinctEntities = new Set(
          all.map((g) => g.belongs_to).filter(Boolean),
        ).size;
        return [
          {
            label: 'Total',
            value: all.length,
            icon: <FolderTree className="h-4 w-4" />,
            filterKey: 'all',
            active: entityFilter === 'all',
          },
          {
            label: 'Entity types',
            value: distinctEntities,
            icon: <Layers className="h-4 w-4" />,
          },
          {
            label: 'Filtered to',
            value:
              entityFilter === 'all'
                ? 'All'
                : (ENTITY_OPTIONS.find((e) => e.value === entityFilter)?.label ?? entityFilter),
            icon: <Tag className="h-4 w-4" />,
          },
        ];
      }}
      onKpiClick={(k) => setEntityFilter(k)}
      filterChips={[
        { key: 'all', label: 'All', active: entityFilter === 'all' },
        ...ENTITY_OPTIONS.map((e) => ({
          key: e.value,
          label: e.label,
          active: entityFilter === e.value,
        })),
      ]}
      onFilterChange={(k) => setEntityFilter(k)}
      columns={[
        {
          key: 'name',
          label: 'Name',
          render: (row) => (
            <RowDrawer
              label={row.name}
              subtitle={String(row.belongs_to || '')}
              title={`Group · ${row.name}`}
              description="Use the row Edit action to change this group."
            >
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Group name</div>
                  <div>{row.name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Applies to</div>
                  <div>{String(row.belongs_to || '—')}</div>
                </div>
                <p className="text-muted-foreground text-xs">
                  Edit and delete are available from the row actions.
                </p>
              </div>
            </RowDrawer>
          ),
        },
        {
          key: 'belongs_to',
          label: 'Target',
          render: (row) => (
            <ZoruBadge variant="ghost">{String(row.belongs_to || '')}</ZoruBadge>
          ),
        },
      ]}
      fields={[
        { name: 'name', label: 'Group name', required: true },
        {
          name: 'belongs_to',
          label: 'Applies to',
          type: 'select',
          required: true,
          options: ENTITY_OPTIONS,
        },
      ]}
    />
  );
}
