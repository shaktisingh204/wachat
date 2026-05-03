'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import { getDocuments, saveDocument } from '@/app/actions/hr.actions';
import type { HrDocument } from '@/lib/hr-types';
import { fields, sections } from '../../_config';

export default function EditDocumentPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = React.useState<
    (HrDocument & { _id: string }) | null
  >(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getDocuments()) as (HrDocument & { _id: string })[];
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
    return <div className="text-[13px] text-muted-foreground">Loading…</div>;
  }

  return (
    <HrFormPage
      title="Edit Document"
      subtitle="Update document details."
      icon={FileText}
      backHref="/dashboard/hrm/hr/documents"
      singular="Document"
      fields={fields}
      sections={sections}
      saveAction={saveDocument}
      initial={record as unknown as Record<string, unknown>}
    />
  );
}
