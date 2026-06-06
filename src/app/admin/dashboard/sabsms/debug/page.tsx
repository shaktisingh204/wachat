import { redirect } from 'next/navigation';

import { getAdminSession } from '@/lib/admin-session';
import { Card, CardBody, CardDescription, CardHeader, CardTitle, PageDescription, PageHeader, PageHeading, PageTitle } from '@/components/sabcrm/20ui';
import { SabsmsDebugSendForm } from './debug-form';
import { sabsmsEngine } from '@/lib/sabsms/engine-client';

export const dynamic = 'force-dynamic';

export default async function SabsmsAdminDebugPage() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) redirect('/admin-login');

  let engineHealthy = false;
  let engineVersion = undefined;
  let engineError = null;

  try {
    const health = await sabsmsEngine.health();
    engineHealthy = health.ok;
    engineVersion = health.version;
  } catch (e: any) {
    engineError = e.message || 'Unknown error connecting to SabSMS engine';
  }

  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeading>
          <PageTitle>SabSMS · Debug send</PageTitle>
          <PageDescription>
            Push a real SMS through the Rust engine to verify the pipeline.
            Uses the Twilio credentials configured on the engine
            (<code className="rounded bg-[var(--st-bg-secondary)] px-1 py-0.5 text-xs">SABSMS_TWILIO_*</code>).
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>One-off send</CardTitle>
          <CardDescription>
            Polls the engine for delivery status until the message reaches a
            terminal state.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {!engineHealthy && (
            <div className="mb-4 rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4 text-sm text-[var(--st-text)]">
              <strong className="font-semibold">Engine Unavailable: </strong>
              {engineError || 'The SabSMS engine is currently down or disabled.'}
            </div>
          )}
          <SabsmsDebugSendForm engineHealthy={engineHealthy} />
        </CardBody>
      </Card>
    </div>
  );
}
