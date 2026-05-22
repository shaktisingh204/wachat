'use client';

import { Skeleton } from '@/components/zoruui';
import {
  use } from 'react';
import { Target } from 'lucide-react';
import { HrFormPage } from '../../../../hr/_components/hr-form-page';
import { getCrmGoals,
  saveCrmGoal } from '@/app/actions/crm-hr.actions';
import { fields,
  sections } from '../../_config';

import * as React from 'react';

export default function EditGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [initial, setInitial] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await getCrmGoals();
        const found = Array.isArray(list)
          ? list.find((r) => String(r._id) === id) || null
          : null;
        if (active) setInitial(found as unknown as Record<string, unknown> | null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex w-full flex-col gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <HrFormPage
      title="Edit goal"
      icon={Target}
      backHref="/dashboard/hrm/payroll/goal-setting"
      singular="Goal"
      fields={fields}
      sections={sections}
      saveAction={saveCrmGoal}
      initial={initial}
    />
  );
}
