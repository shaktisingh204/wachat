'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { HrFormPage } from '../../../_components/hr-form-page';
import {
  getDocumentTemplates,
  saveDocumentTemplate,
} from '@/app/actions/hr.actions';
import type { HrDocumentTemplate } from '@/lib/hr-types';
import { fields, sections } from '../../_config';

export default function EditDocumentTemplatePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [record, setRecord] = React.useState<
    (HrDocumentTemplate & { _id: string }) | null
  >(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = (await getDocumentTemplates()) as (HrDocumentTemplate & {
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
      title="Edit Template"
      subtitle="Update template details."
      icon={ClipboardList}
      backHref="/dashboard/crm/hr/document-templates"
      singular="Template"
      fields={fields}
      sections={sections}
      saveAction={saveDocumentTemplate}
      initial={record as unknown as Record<string, unknown>}
    />
  );
}
