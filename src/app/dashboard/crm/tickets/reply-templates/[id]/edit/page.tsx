import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  MessageSquareText } from 'lucide-react';

/**
 * Edit reply template — server wrapper that loads the template by id
 * and passes it as `initialData` to `<ReplyTemplateForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';
import { getReplyTemplateById } from '@/app/actions/crm-reply-templates.actions';

import { ReplyTemplateForm } from '../../_components/reply-template-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/tickets/reply-templates';

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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        breadcrumbs={[
          { label: 'Tickets', href: '/dashboard/crm/tickets' },
          { label: 'Reply Templates', href: BASE },
          { label: template.name, href: `${BASE}/${id}` },
          { label: 'Edit' },
        ]}
        title={`Edit · ${template.name}`}
        subtitle="Update the canned reply body and metadata."
        icon={MessageSquareText}
        actions={
          <ZoruButton variant="ghost" asChild>
            <Link href={`${BASE}/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to detail
            </Link>
          </ZoruButton>
        }
      />

      <ReplyTemplateForm initialData={template} />
    </div>
  );
}
