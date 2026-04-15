'use client';

import { use, useEffect, useState } from 'react';
import { Route } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import { getLearningPaths, saveLearningPath } from '@/app/actions/hr.actions';
import type { HrLearningPath } from '@/lib/hr-types';
import { fields, sections } from '../../_config';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditLearningPathPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [initial, setInitial] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = (await getLearningPaths()) as (HrLearningPath & { _id: string })[];
        if (!mounted) return;
        const found = Array.isArray(list)
          ? list.find((r) => String(r._id) === id) || null
          : null;
        setInitial(found as Record<string, unknown> | null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
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
      title="Edit Learning Path"
      subtitle="Update learning path details."
      icon={Route}
      backHref="/dashboard/hrm/hr/learning-paths"
      singular="Path"
      fields={fields}
      sections={sections}
      saveAction={saveLearningPath}
      initial={initial}
    />
  );
}
