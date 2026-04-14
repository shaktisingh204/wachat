'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import { getPolicies, savePolicy } from '@/app/actions/hr.actions';
import type { HrPolicy } from '@/lib/hr-types';
import { fields, sections } from '../../_config';

export default function EditPolicyPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = React.useState<
    (HrPolicy & { _id: string }) | null
  >(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getPolicies()) as (HrPolicy & { _id: string })[];
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
      title="Edit Policy"
      subtitle="Update policy details."
      icon={FileText}
      backHref="/dashboard/crm/hr/policies"
      singular="Policy"
      fields={fields}
      sections={sections}
      saveAction={savePolicy}
      initial={record as unknown as Record<string, unknown>}
    />
  );
}
