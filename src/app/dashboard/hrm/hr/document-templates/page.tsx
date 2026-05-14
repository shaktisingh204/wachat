'use client';

import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

import { ClipboardList } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getDocumentTemplates,
  saveDocumentTemplate,
  deleteDocumentTemplate,
} from '@/app/actions/hr.actions';
import type { HrDocumentTemplate } from '@/lib/hr-types';
import { fields } from './_config';

export default function DocumentTemplatesPage() {
  return (
    <HrEntityPage<HrDocumentTemplate & { _id: string }>
      title="Document Templates"
      subtitle="Reusable templates for offer letters, NDAs, and more."
      icon={ClipboardList}
      singular="Template"
      basePath="/dashboard/hrm/hr/document-templates"
      rowLinksToDetail
      getAllAction={getDocumentTemplates as any}
      saveAction={saveDocumentTemplate}
      deleteAction={deleteDocumentTemplate}
      kpis={[
        {
          label: 'Total',
          compute: (rows) => rows.length,
        },
        {
          label: 'Categories',
          compute: (rows) => {
            const set = new Set(
              rows.map((r) => String((r as any).category || '')).filter(Boolean),
            );
            return set.size;
          },
        },
        {
          label: 'With placeholders',
          compute: (rows) =>
            rows.filter((r) => {
              const p = (r as any).placeholders;
              return Array.isArray(p) ? p.length > 0 : false;
            }).length,
        },
        {
          label: 'Last updated',
          compute: (rows) => {
            const dates = rows
              .map((r) => {
                const v = (r as any).updatedAt || (r as any).createdAt;
                return v ? new Date(v).getTime() : 0;
              })
              .filter((n) => n > 0);
            if (dates.length === 0) return '—';
            return new Date(Math.max(...dates)).toLocaleDateString();
          },
        },
      ]}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'category', label: 'Category' },
        {
          key: 'version',
          label: 'Version',
          render: (row) => (row as any).version || '—',
        },
        {
          key: 'placeholders',
          label: 'Placeholders',
          render: (row) => {
            const p = (row as any).placeholders;
            return Array.isArray(p) ? p.length : 0;
          },
        },
      ]}
      fields={fields}
    />
  );
}
