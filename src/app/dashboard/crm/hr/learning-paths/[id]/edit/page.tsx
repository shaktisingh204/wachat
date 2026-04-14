'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Route } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import {
  getLearningPaths,
  saveLearningPath,
} from '@/app/actions/hr.actions';
import type { HrLearningPath } from '@/lib/hr-types';
import { fields, sections } from '../../_config';

export default function EditLearningPathPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = React.useState<
    (HrLearningPath & { _id: string }) | null
  >(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getLearningPaths()) as (HrLearningPath & {
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
      title="Edit Learning Path"
      subtitle="Update learning path details."
      icon={Route}
      backHref="/dashboard/crm/hr/learning-paths"
      singular="Path"
      fields={fields}
      sections={sections}
      saveAction={saveLearningPath}
      initial={record as unknown as Record<string, unknown>}
    />
  );
}
