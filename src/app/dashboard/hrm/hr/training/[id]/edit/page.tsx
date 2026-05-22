'use client';

import { Skeleton } from '@/components/zoruui';
import {
  use,
  useEffect,
  useState } from 'react';
import { BookOpen } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import { getTrainingPrograms,
  saveTrainingProgram } from '@/app/actions/hr.actions';
import type { HrTrainingProgram } from '@/lib/hr-types';
import { fields,
  sections } from '../../_config';

export default function EditTrainingProgramPage({
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
        const list = (await getTrainingPrograms()) as (HrTrainingProgram & { _id: string })[];
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
        <ZoruSkeleton className="h-12 w-full" />
        <ZoruSkeleton className="h-64 w-full" />
      </div>
    );
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
      initial={initial}
    />
  );
}
