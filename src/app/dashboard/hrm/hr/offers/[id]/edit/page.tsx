'use client';

import { Skeleton } from '@/components/zoruui';
import {
  use,
  useEffect,
  useState } from 'react';
import { Send } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import { fields,
  sections } from '../../_config';
import { getOfferLetterById,
  saveOfferLetter } from '@/app/actions/hr.actions';

export default function EditOfferPage({
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
        const doc = await getOfferLetterById(id);
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
        <ZoruSkeleton className="h-12 w-full" />
        <ZoruSkeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <HrFormPage
      title="Edit Offer"
      subtitle="Update offer details."
      icon={Send}
      backHref="/dashboard/hrm/hr/offers"
      singular="Offer"
      fields={fields}
      sections={sections}
      saveAction={saveOfferLetter}
      initial={initial}
    />
  );
}
