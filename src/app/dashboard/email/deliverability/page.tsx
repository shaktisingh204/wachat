import { EmailSuiteLayout } from '@/components/email/layout';
import { DeliverabilityClient } from '@/components/email/deliverability/deliverability-client';

export default function EmailDeliverabilityPage() {
  return (
    <EmailSuiteLayout>
      <DeliverabilityClient />
    </EmailSuiteLayout>
  );
}
