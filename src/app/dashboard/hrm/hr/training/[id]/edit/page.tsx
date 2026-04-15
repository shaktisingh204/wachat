'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import {
  getTrainingPrograms,
  saveTrainingProgram,
} from '@/app/actions/hr.actions';
import type { HrTrainingProgram } from '@/lib/hr-types';
import { fields, sections } from '../../_config';

export default function EditTrainingProgramPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = React.useState<
    (HrTrainingProgram & { _id: string }) | null
  >(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getTrainingPrograms()) as (HrTrainingProgram & {
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
      title="Edit Training Program"
      subtitle="Update program details."
      icon={BookOpen}
      backHref="/dashboard/hrm/hr/training"
      singular="Program"
      fields={fields}
      sections={sections}
      saveAction={saveTrainingProgram}
      initial={record as unknown as Record<string, unknown>}
    />
  );
}
