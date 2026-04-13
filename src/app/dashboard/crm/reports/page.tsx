import { Activity, FileBarChart } from 'lucide-react';

import { CrmModuleOverview } from '../_components/crm-module-overview';

export default function ReportsOverviewPage() {
  return (
    <CrmModuleOverview
      title="Reports"
      subtitle="Compliance reports — GST returns and other regulatory filings."
      icon={Activity}
      sections={[
        {
          href: '/dashboard/crm/reports/gstr-1',
          label: 'GSTR-1',
          description: 'Outward supplies return — sales for the period.',
          icon: FileBarChart,
        },
        {
          href: '/dashboard/crm/reports/gstr-2b',
          label: 'GSTR-2B',
          description: 'Auto-drafted inward supplies return from vendors.',
          icon: FileBarChart,
        },
      ]}
    />
  );
}
