/**
 * Full-screen email template builder route.
 *
 * Server component fetches the template once, then hydrates the
 * client `<BuilderShell>` with the loaded doc. The builder UI manages
 * its own state from there.
 */
import { notFound } from 'next/navigation';

import { BuilderShell } from '@/components/email/templates/builder/builder-shell';
import { emptyDocument } from '@/components/email/templates/builder/block-defaults';
import { actionGetEmailTemplate } from '@/app/actions/email/templates.actions';

interface PageProps {
  params: Promise<{ templateId: string }>;
}

export default async function EmailTemplateBuilderPage({ params }: PageProps) {
  const { templateId } = await params;
  const res = await actionGetEmailTemplate(templateId);
  if (!res.ok) {
    notFound();
  }

  const tpl = res.data;
  return (
    <BuilderShell
      templateId={tpl._id}
      initialName={tpl.name}
      initialSubject={tpl.subject}
      initialDoc={tpl.builderJson ?? emptyDocument()}
    />
  );
}
