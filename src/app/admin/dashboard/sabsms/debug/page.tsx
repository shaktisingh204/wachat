import { redirect } from 'next/navigation';

import { getAdminSession } from '@/lib/admin-session';
import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/sabcrm/20ui/compat';
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
        <ZoruPageHeading>
          <ZoruPageTitle>SabSMS · Debug send</ZoruPageTitle>
          <ZoruPageDescription>
            Push a real SMS through the Rust engine to verify the pipeline.
            Uses the Twilio credentials configured on the engine
            (<code className="rounded bg-[var(--st-bg-secondary)] px-1 py-0.5 text-xs">SABSMS_TWILIO_*</code>).
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>One-off send</ZoruCardTitle>
          <ZoruCardDescription>
            Polls the engine for delivery status until the message reaches a
            terminal state.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          {!engineHealthy && (
            <div className="mb-4 rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4 text-sm text-[var(--st-text)]">
              <strong className="font-semibold">Engine Unavailable: </strong>
              {engineError || 'The SabSMS engine is currently down or disabled.'}
            </div>
          )}
          <SabsmsDebugSendForm engineHealthy={engineHealthy} />
        </ZoruCardContent>
      </Card>
    </div>
  );
}
