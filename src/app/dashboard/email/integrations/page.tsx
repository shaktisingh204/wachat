import { EmailSuiteLayout } from '@/components/email/layout';
import { IntegrationsClient } from '@/components/email/integrations/integrations-client';

export default function EmailIntegrationsPage() {
  return (
    <EmailSuiteLayout>
      <IntegrationsClient />
    </EmailSuiteLayout>
  );
}
