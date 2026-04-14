'use client';

import { use, useEffect, useState } from 'react';
import { MessagesSquare } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import { fields, sections } from '../../_config';
import { getOneOnOnes, saveOneOnOne } from '@/app/actions/hr.actions';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditOneOnOnePage({
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
        const all = await getOneOnOnes();
        if (!mounted) return;
        const doc = (all as any[]).find((r) => String(r._id) === id);
        setInitial(doc ? ({ ...doc, _id: String(doc._id) } as any) : null);
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
      title="Edit One-on-One"
      subtitle="Update the check-in details."
      icon={MessagesSquare}
      backHref="/dashboard/crm/hr/one-on-ones"
      singular="One-on-One"
      fields={fields}
      sections={sections}
      saveAction={saveOneOnOne}
      initial={initial}
    />
  );
}
