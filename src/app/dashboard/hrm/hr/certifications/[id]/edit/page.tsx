'use client';

import { use, useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import { getCertifications, saveCertification } from '@/app/actions/hr.actions';
import type { HrCertification } from '@/lib/hr-types';
import { fields, sections } from '../../_config';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditCertificationPage({
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
        const list = (await getCertifications()) as (HrCertification & { _id: string })[];
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
      title="Edit Certification"
      subtitle="Update credential details."
      icon={Award}
      backHref="/dashboard/hrm/hr/certifications"
      singular="Certification"
      fields={fields}
      sections={sections}
      saveAction={saveCertification}
      initial={initial}
    />
  );
}
