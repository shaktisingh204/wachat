'use client';

import { use, useEffect, useState, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getProposalTemplateById } from '@/app/actions/worksuite/proposals.actions';
import {
  TemplateEditor,
  initialFromTemplate,
  type TemplateEditorInitial,
} from '../_components/template-editor';

export default function EditProposalTemplatePage(props: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = use(props.params);
  const [initial, setInitial] = useState<TemplateEditorInitial | null>(null);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    startLoading(async () => {
      const data = await getProposalTemplateById(templateId);
      if (data) setInitial(initialFromTemplate(data.template, data.items));
      else setInitial({});
    });
  }, [templateId]);

  if (isLoading && !initial) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <TemplateEditor initial={initial || {}} />;
}
