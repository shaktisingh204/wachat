'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { LineChart } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import {
  getCompensationBands,
  saveCompensationBand,
} from '@/app/actions/hr.actions';
import type { HrCompensationBand } from '@/lib/hr-types';
import { fields, sections } from '../../_config';

export default function EditCompensationBandPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = React.useState<
    (HrCompensationBand & { _id: string }) | null
  >(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getCompensationBands()) as (HrCompensationBand & {
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
    return <div className="text-[13px] text-muted-foreground">Loading…</div>;
  }

  return (
    <HrFormPage
      title="Edit Compensation Band"
      subtitle="Update band details."
      icon={LineChart}
      backHref="/dashboard/hrm/hr/compensation-bands"
      singular="Band"
      fields={fields}
      sections={sections}
      saveAction={saveCompensationBand}
      initial={record as unknown as Record<string, unknown>}
    />
  );
}
