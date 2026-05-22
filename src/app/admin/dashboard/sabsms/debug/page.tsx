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
} from '@/components/zoruui';
import { SabsmsDebugSendForm } from './debug-form';

export const dynamic = 'force-dynamic';

export default async function SabsmsAdminDebugPage() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) redirect('/admin-login');

  return (
    <div className="space-y-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>SabSMS · Debug send</ZoruPageTitle>
          <ZoruPageDescription>
            Push a real SMS through the Rust engine to verify the pipeline.
            Uses the Twilio credentials configured on the engine
            (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs">SABSMS_TWILIO_*</code>).
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
          <SabsmsDebugSendForm />
        </ZoruCardContent>
      </Card>
    </div>
  );
}
