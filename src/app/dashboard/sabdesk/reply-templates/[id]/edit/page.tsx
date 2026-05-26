import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit reply template — server wrapper that loads the template by id
 * and passes it as `initialData` to `<ReplyTemplateForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getReplyTemplateById } from '@/app/actions/crm-reply-templates.actions';

import { ReplyTemplateForm } from '../../_components/reply-template-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/sabdesk/reply-templates';

export default async function EditReplyTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) redirect('/login');

  const template = await getReplyTemplateById(id);
  if (!template) notFound();

  return (
    <EntityDetailShell
      eyebrow="REPLY TEMPLATE"
      title={`Edit · ${template.name}`}
      back={{ href: `${BASE}/${id}`, label: 'Back to detail' }}
    >
      <ReplyTemplateForm initialData={template} />
    </EntityDetailShell>
  );
}
