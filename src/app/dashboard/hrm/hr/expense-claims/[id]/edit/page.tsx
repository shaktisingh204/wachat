'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import {
  getExpenseClaims,
  saveExpenseClaim,
} from '@/app/actions/hr.actions';
import type { HrExpenseClaim } from '@/lib/hr-types';
import { fields, sections } from '../../_config';

export default function EditExpenseClaimPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = React.useState<
    (HrExpenseClaim & { _id: string }) | null
  >(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getExpenseClaims()) as (HrExpenseClaim & {
          _id: string;
        })[];
        const found = Array.isArray(list)
          ? list.find((r) => String(r._id) === String(id)) || null
          : null;
        if (active) setRecord(found);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <div className="p-6 text-[13px] text-clay-ink-muted">Loading…</div>;
  }

  return (
    <HrFormPage
      title="Edit Expense Claim"
      subtitle="Update claim details."
      icon={Wallet}
      backHref="/dashboard/hrm/hr/expense-claims"
      singular="Claim"
      fields={fields}
      sections={sections}
      saveAction={saveExpenseClaim}
      initial={record as unknown as Record<string, unknown>}
    />
  );
}
