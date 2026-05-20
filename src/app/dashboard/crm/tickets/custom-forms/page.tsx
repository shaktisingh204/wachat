'use client';

/**
 * Ticket Custom Fields — §1D.4 bar:
 *  - KPI strip (Total fields · Required fields · by field type)
 *  - Search across field_name / field_type
 *  - Filter chips: All / Required / Optional
 *  - Bulk delete + CSV export
 *  - Inline create + edit dialog
 *  - RowDrawer on field name
 */

import * as React from 'react';
import { FormInput, Star, Tag } from 'lucide-react';
import { ZoruBadge } from '@/components/zoruui';

import { RowDrawer } from '@/components/crm/row-drawer';
import { SettingsEntityShell } from '@/components/crm/settings-entity-shell';
import {
  getTicketCustomForms,
  saveTicketCustomForm,
  deleteTicketCustomForm,
} from '@/app/actions/worksuite/tickets-ext.actions';
import type { WsTicketCustomForm } from '@/lib/worksuite/tickets-ext-types';

type Row = WsTicketCustomForm & { _id: string };

type RequiredFilter = 'all' | 'required' | 'optional';

export default function TicketCustomFormsPage() {
  const [reqFilter, setReqFilter] = React.useState<RequiredFilter>('all');

  const getAll = React.useCallback(async () => {
    const list = (await getTicketCustomForms()) as Row[];
    if (reqFilter === 'required') return list.filter((f) => f.is_required);
    if (reqFilter === 'optional') return list.filter((f) => !f.is_required);
    return list;
  }, [reqFilter]);

  return (
    <SettingsEntityShell<Row>
      title="Ticket Custom Fields"
      subtitle="Additional form fields to collect on ticket creation."
      singular="Field"
      getAllAction={getAll}
      saveAction={saveTicketCustomForm}
      deleteAction={deleteTicketCustomForm}
      csvFilename="ticket-custom-fields"
      kpis={(_rows, all) => {
        const required = all.filter((f) => f.is_required).length;
        const distinctTypes = new Set(all.map((f) => f.field_type).filter(Boolean)).size;
        return [
          {
            label: 'Total fields',
            value: all.length,
            icon: <FormInput className="h-4 w-4" />,
            filterKey: 'all',
            active: reqFilter === 'all',
          },
          {
            label: 'Required',
            value: required,
            icon: <Star className="h-4 w-4" />,
            filterKey: 'required',
            active: reqFilter === 'required',
          },
          {
            label: 'Optional',
            value: all.length - required,
            icon: <Tag className="h-4 w-4" />,
            filterKey: 'optional',
            active: reqFilter === 'optional',
          },
          {
            label: 'Field types',
            value: distinctTypes,
          },
        ];
      }}
      onKpiClick={(k) => setReqFilter(k as RequiredFilter)}
      filterChips={[
        { key: 'all', label: 'All', active: reqFilter === 'all' },
        { key: 'required', label: 'Required', active: reqFilter === 'required' },
        { key: 'optional', label: 'Optional', active: reqFilter === 'optional' },
      ]}
      onFilterChange={(k) => setReqFilter(k as RequiredFilter)}
      columns={[
        {
          key: 'field_name',
          label: 'Field',
          render: (row) => (
            <RowDrawer
              label={row.field_name}
              subtitle={row.field_type}
              title={`Field · ${row.field_name}`}
              description="Use the row Edit action to change this field."
            >
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Field name</div>
                  <div>{row.field_name}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Type</div>
                  <div>{row.field_type}</div>
                </div>
                {row.field_values ? (
                  <div>
                    <div className="text-muted-foreground text-xs">Values</div>
                    <div className="font-mono text-xs">{row.field_values}</div>
                  </div>
                ) : null}
                <div>
                  <div className="text-muted-foreground text-xs">Required</div>
                  <div>{row.is_required ? 'Yes' : 'No'}</div>
                </div>
              </div>
            </RowDrawer>
          ),
        },
        { key: 'field_type', label: 'Type' },
        { key: 'field_values', label: 'Values' },
        {
          key: 'is_required',
          label: 'Required',
          render: (r) => (
            <ZoruBadge variant={r.is_required ? 'warning' : 'ghost'}>
              {r.is_required ? 'Yes' : 'No'}
            </ZoruBadge>
          ),
        },
      ]}
      fields={[
        { name: 'field_name', label: 'Field Name', required: true, fullWidth: true },
        {
          name: 'field_type',
          label: 'Field Type',
          type: 'select',
          required: true,
          options: [
            { value: 'text', label: 'Text' },
            { value: 'textarea', label: 'Textarea' },
            { value: 'select', label: 'Select' },
            { value: 'radio', label: 'Radio' },
            { value: 'checkbox', label: 'Checkbox' },
            { value: 'number', label: 'Number' },
            { value: 'date', label: 'Date' },
            { value: 'email', label: 'Email' },
            { value: 'url', label: 'URL' },
          ],
        },
        {
          name: 'field_values',
          label: 'Values (pipe-separated for select/radio/checkbox)',
          fullWidth: true,
        },
        {
          name: 'is_required',
          label: 'Required',
          type: 'select',
          options: [
            { value: 'false', label: 'No' },
            { value: 'true', label: 'Yes' },
          ],
        },
      ]}
    />
  );
}
