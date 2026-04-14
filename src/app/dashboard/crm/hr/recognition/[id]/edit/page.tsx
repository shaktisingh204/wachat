'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Award } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import {
  getRecognitions,
  saveRecognition,
} from '@/app/actions/hr.actions';
import type { HrRecognition } from '@/lib/hr-types';
import { fields, sections } from '../../_config';

export default function EditRecognitionPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = React.useState<
    (HrRecognition & { _id: string }) | null
  >(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getRecognitions()) as (HrRecognition & {
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
      title="Edit Recognition"
      subtitle="Update recognition details."
      icon={Award}
      backHref="/dashboard/crm/hr/recognition"
      singular="Recognition"
      fields={fields}
      sections={sections}
      saveAction={saveRecognition}
      initial={record as unknown as Record<string, unknown>}
    />
  );
}
