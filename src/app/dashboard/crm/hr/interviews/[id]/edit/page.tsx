'use client';

import { use, useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import { fields, sections } from '../../_config';
import { getInterviewById, saveInterview } from '@/app/actions/hr.actions';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditInterviewPage({
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
        const doc = await getInterviewById(id);
        if (!mounted) return;
        setInitial(doc ? ({ ...doc, _id: String((doc as any)._id) } as any) : null);
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
      title="Edit Interview"
      subtitle="Update interview details and feedback."
      icon={Calendar}
      backHref="/dashboard/crm/hr/interviews"
      singular="Interview"
      fields={fields}
      sections={sections}
      saveAction={saveInterview}
      initial={initial}
    />
  );
}
