'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Package } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import { getAssets, saveAsset } from '@/app/actions/hr.actions';
import type { HrAsset } from '@/lib/hr-types';
import { fields, sections } from '../../_config';

export default function EditAssetPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = React.useState<(HrAsset & { _id: string }) | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getAssets()) as (HrAsset & { _id: string })[];
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
    return <div className="text-[13px] text-clay-ink-muted">Loading…</div>;
  }

  return (
    <HrFormPage
      title="Edit Asset"
      subtitle="Update asset details."
      icon={Package}
      backHref="/dashboard/hrm/hr/assets"
      singular="Asset"
      fields={fields}
      sections={sections}
      saveAction={saveAsset}
      initial={record as unknown as Record<string, unknown>}
    />
  );
}
