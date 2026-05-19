import { EmailSuiteLayout } from '@/components/email/layout';
import { ReportsClient } from '@/components/email/reports/reports-client';

export default function EmailReportsPage() {
  return (
    <EmailSuiteLayout>
      <ReportsClient />
    </EmailSuiteLayout>
  );
}
