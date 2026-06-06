'use client';

import { cn as _zoruCn } from '@/components/sabcrm/20ui';
void _zoruCn;

import { UserPlus } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getSuccessionPlans,
  saveSuccessionPlan,
  deleteSuccessionPlan,
} from '@/app/actions/hr.actions';
import type { HrSuccessionPlan } from '@/lib/hr-types';

const READINESS_TONES: Record<string, 'neutral' | 'green' | 'amber'> = {
  'ready-now': 'green',
  'ready-1yr': 'amber',
  'ready-2yr': 'neutral',
};

export default function SuccessionPage() {
  return (
    <HrEntityPage<HrSuccessionPlan & { _id: string }>
      title="Succession Planning"
      subtitle="Role continuity and successor readiness."
      icon={UserPlus}
      singular="Plan"
      basePath="/dashboard/hrm/hr/succession"
      rowLinksToDetail
      getAllAction={getSuccessionPlans as any}
      saveAction={saveSuccessionPlan}
      deleteAction={deleteSuccessionPlan}
      kpis={[
        {
          label: 'Active plans',
          compute: (rows) => rows.length,
        },
        {
          label: 'Ready-now successors',
          compute: (rows) =>
            rows.filter(
              (r) =>
                String((r as any).readiness || '').toLowerCase() === 'ready-now' ||
                String((r as any).readiness || '').toLowerCase() === 'ready',
            ).length,
          tone: 'green',
        },
        {
          label: 'Ready in 1yr',
          compute: (rows) =>
            rows.filter(
              (r) => String((r as any).readiness || '').toLowerCase() === 'ready-1yr',
            ).length,
          tone: 'amber',
        },
        {
          label: 'Ready in 2yr+',
          compute: (rows) =>
            rows.filter(
              (r) => String((r as any).readiness || '').toLowerCase() === 'ready-2yr',
            ).length,
        },
        {
          label: 'Roles covered',
          compute: (rows) => {
            const set = new Set(
              rows
                .map((r) => String((r as any).role || (r as any).position || ''))
                .filter(Boolean),
            );
            return set.size;
          },
        },
      ]}
      columns={[
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'successorId', label: 'Successor ID' },
        {
          key: 'readiness',
          label: 'Readiness',
          render: (row) => {
            const v = (row as any).readiness || 'ready-2yr';
            return (
              <ClayBadge tone={READINESS_TONES[v] || 'neutral'} dot>
                {v}
              </ClayBadge>
            );
          },
        },
      ]}
      fields={[
        { name: 'employeeId', label: 'Employee ID', required: true },
        { name: 'successorId', label: 'Successor ID', required: true },
        {
          name: 'readiness',
          label: 'Readiness',
          type: 'select',
          required: true,
          options: [
            { value: 'ready-now', label: 'Ready Now' },
            { value: 'ready-1yr', label: 'Ready in 1 Year' },
            { value: 'ready-2yr', label: 'Ready in 2 Years' },
          ],
          defaultValue: 'ready-2yr',
        },
        {
          name: 'notes',
          label: 'Notes',
          type: 'textarea',
          fullWidth: true,
        },
      ]}
    />
  );
}
