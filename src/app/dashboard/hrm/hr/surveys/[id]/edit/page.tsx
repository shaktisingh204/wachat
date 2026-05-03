'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Gauge } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import { getSurveys, saveSurvey } from '@/app/actions/hr.actions';
import type { HrSurvey } from '@/lib/hr-types';
import { fields, sections } from '../../_config';

export default function EditSurveyPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = React.useState<
    (HrSurvey & { _id: string }) | null
  >(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getSurveys()) as (HrSurvey & { _id: string })[];
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
      title="Edit Survey"
      subtitle="Update survey details."
      icon={Gauge}
      backHref="/dashboard/hrm/hr/surveys"
      singular="Survey"
      fields={fields}
      sections={sections}
      saveAction={saveSurvey}
      initial={record as unknown as Record<string, unknown>}
    />
  );
}
