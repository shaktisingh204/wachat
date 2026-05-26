import { redirect } from 'next/navigation';

/**
 * New reply template — server wrapper around `<ReplyTemplateForm />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';

import { ReplyTemplateForm } from '../_components/reply-template-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/sabdesk/reply-templates';

export default async function NewReplyTemplatePage() {
  const session = await getSession();
  if (!session?.user) redirect('/login');

  return (
    <EntityDetailShell
      eyebrow="REPLY TEMPLATE"
      title="New reply template"
      back={{ href: BASE, label: 'Reply Templates' }}
    >
      <ReplyTemplateForm />
    </EntityDetailShell>
  );
}
