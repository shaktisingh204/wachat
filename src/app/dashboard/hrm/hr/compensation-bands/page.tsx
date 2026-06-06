'use client';

import { cn as _zoruCn } from '@/components/sabcrm/20ui/compat';
void _zoruCn;

import { LineChart } from 'lucide-react';
import { HrEntityPage } from '../_components/hr-entity-page';
import {
  getCompensationBands,
  saveCompensationBand,
  deleteCompensationBand,
} from '@/app/actions/hr.actions';
import type { HrCompensationBand } from '@/lib/hr-types';
import { fields } from './_config';

export default function CompensationBandsPage() {
  return (
    <HrEntityPage<HrCompensationBand & { _id: string }>
      title="Compensation Bands"
      subtitle="Salary bands by level and role."
      icon={LineChart}
      singular="Band"
      basePath="/dashboard/hrm/hr/compensation-bands"
      rowLinksToDetail
      getAllAction={getCompensationBands as any}
      saveAction={saveCompensationBand}
      deleteAction={deleteCompensationBand}
      kpis={[
        {
          label: 'Total bands',
          compute: (rows) => rows.length,
        },
        {
          label: 'Active',
          compute: (rows) =>
            rows.filter(
              (r) =>
                (r as any).isActive === true ||
                (r as any).isActive === 'yes' ||
                (r as any).isActive === undefined,
            ).length,
          tone: 'green',
        },
        {
          label: 'Distinct levels',
          compute: (rows) => {
            const set = new Set(
              rows.map((r) => String((r as any).level || '').toLowerCase()).filter(Boolean),
            );
            return set.size;
          },
        },
        {
          label: 'Avg min salary',
          compute: (rows) => {
            const vals = rows
              .map((r) => Number((r as any).min_salary))
              .filter((n) => !Number.isNaN(n) && n > 0);
            if (vals.length === 0) return '—';
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            return new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 0,
            }).format(avg);
          },
        },
        {
          label: 'Avg max salary',
          compute: (rows) => {
            const vals = rows
              .map((r) => Number((r as any).max_salary))
              .filter((n) => !Number.isNaN(n) && n > 0);
            if (vals.length === 0) return '—';
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            return new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 0,
            }).format(avg);
          },
        },
      ]}
      columns={[
        { key: 'title', label: 'Role / Designation' },
        { key: 'level', label: 'Level' },
        { key: 'department', label: 'Department' },
        { key: 'min_salary', label: 'Min' },
        { key: 'max_salary', label: 'Max' },
        { key: 'currency', label: 'Currency' },
        { key: 'currency_type', label: 'Type' },
      ]}
      fields={fields}
    />
  );
}
