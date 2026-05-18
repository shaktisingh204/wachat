'use client';

import { ZoruSkeleton } from '@/components/zoruui';
import {
  use } from 'react';
import { Star } from 'lucide-react';

import { HrFormPage } from '../../../../hr/_components/hr-form-page';
import {
  getCrmAppraisalReviews,
  saveCrmAppraisalReview,
  } from '@/app/actions/crm-hr-appraisals.actions';
import { fields,
  sections } from '../../_config';

import * as React from 'react';

export default function EditAppraisalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [initial, setInitial] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await getCrmAppraisalReviews();
        const found = Array.isArray(list)
          ? list.find((r) => String(r._id) === id) || null
          : null;
        if (!active) return;
        // Flatten ratings.* → rating_* so the form fields read defaults.
        if (found) {
          const r = found as unknown as {
            ratings?: Record<string, number>;
          } & Record<string, unknown>;
          const flat: Record<string, unknown> = { ...r };
          if (r.ratings) {
            for (const [k, v] of Object.entries(r.ratings)) {
              flat[`rating_${k}`] = v;
            }
          }
          setInitial(flat);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
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
      title="Edit appraisal review"
      icon={Star}
      backHref="/dashboard/crm/hr-payroll/appraisal-reviews"
      singular="Review"
      fields={fields}
      sections={sections}
      saveAction={saveCrmAppraisalReview}
      initial={initial}
    />
  );
}
