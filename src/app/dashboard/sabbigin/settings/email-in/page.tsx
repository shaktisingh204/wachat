/**
 * SabBigin Email-In — pipeline email aliases via SabMail.
 */
import Link from 'next/link';
import { ChevronLeft, Inbox } from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Card,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import { getSabbiginEmailIn } from '@/app/actions/sabbigin-emailin.actions';
import { EmailInClient } from './_components/email-in-client';

export const dynamic = 'force-dynamic';

export default async function SabbiginEmailInPage() {
  const [data, pipelines] = await Promise.all([
    getSabbiginEmailIn(),
    getCrmPipelines(),
  ]);
  const pipelineList = pipelines.map((p) => ({ id: String(p.id), name: p.name }));

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link
              href="/dashboard/sabbigin/settings"
              className="inline-flex items-center gap-1 hover:text-[var(--st-accent)]"
            >
              <ChevronLeft size={12} /> Settings
            </Link>
          </PageEyebrow>
          <PageTitle>Email-In</PageTitle>
          <PageDescription>
            Turn an email address into a pipeline inbox — mail sent to it opens a
            deal automatically. Powered by SabMail.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {!data.hasDomain ? (
        <Card padding="none" className="flex min-h-[280px] items-center justify-center">
          <EmptyState
            icon={Inbox}
            title="Add a mail domain first"
            description="Email-In aliases live on a domain you own. Set one up in SabMail, then come back to route it to a pipeline."
            action={
              <Link href="/dashboard/sabmail" className="u-btn u-btn--primary u-btn--sm">
                <span className="u-btn__label">Open SabMail</span>
              </Link>
            }
          />
        </Card>
      ) : (
        <EmailInClient data={data} pipelines={pipelineList} />
      )}
    </div>
  );
}
