import { ZoruButton } from '@/components/zoruui';
import {
  redirect } from 'next/navigation';
import { ArrowLeft,
  MessageSquareText } from 'lucide-react';

/**
 * New reply template — server wrapper around `<ReplyTemplateForm />`.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { getSession } from '@/app/actions/user.actions';

import { ReplyTemplateForm } from '../_components/reply-template-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/tickets/reply-templates';

export default async function NewReplyTemplatePage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        breadcrumbs={[
          { label: 'Tickets', href: '/dashboard/crm/tickets' },
          { label: 'Reply Templates', href: BASE },
          { label: 'New' },
        ]}
        title="New reply template"
        subtitle="Compose a canned reply with {{variable}} placeholders."
        icon={MessageSquareText}
        actions={
          <ZoruButton variant="ghost" asChild>
            <Link href={BASE}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to list
            </Link>
          </ZoruButton>
        }
      />

      <ReplyTemplateForm />
    </div>
  );
}
