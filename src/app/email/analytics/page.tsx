import { ReportsClient } from '@/components/email/reports/reports-client';

export const metadata = {
  title: 'Email Analytics',
};

export default function EmailAnalyticsPage() {
  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <ReportsClient />
    </div>
  );
}
