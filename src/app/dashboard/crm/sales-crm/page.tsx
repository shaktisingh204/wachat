import {
  Target,
  Columns3,
  Users,
  BarChart,
  TrendingUp,
  LineChart,
  ClipboardList,
} from 'lucide-react';

import { CrmModuleOverview } from '../_components/crm-module-overview';

export default function SalesCrmOverviewPage() {
  return (
    <CrmModuleOverview
      title="Sales CRM"
      subtitle="Leads, pipelines, capture forms, and sales performance reports."
      icon={Target}
      sections={[
        {
          href: '/dashboard/crm/sales-crm/all-leads',
          label: 'All Leads',
          description: 'Review every incoming lead and its current stage.',
          icon: Users,
        },
        {
          href: '/dashboard/crm/sales-crm/pipelines',
          label: 'Pipelines',
          description: 'Configure your sales pipelines and stages.',
          icon: Columns3,
        },
        {
          href: '/dashboard/crm/sales-crm/all-pipelines',
          label: 'All Pipelines',
          description: 'Overview of every pipeline in your workspace.',
          icon: Columns3,
        },
        {
          href: '/dashboard/crm/sales-crm/forms',
          label: 'Lead Capture Forms',
          description: 'Build and embed lead-capture forms.',
          icon: ClipboardList,
        },
        {
          href: '/dashboard/crm/sales-crm/leads-summary',
          label: 'Leads Summary',
          description: 'Aggregate view of lead volume and conversion.',
          icon: BarChart,
        },
        {
          href: '/dashboard/crm/sales-crm/lead-source-report',
          label: 'Lead Source Report',
          description: 'See which channels send the best leads.',
          icon: BarChart,
        },
        {
          href: '/dashboard/crm/sales-crm/team-sales-report',
          label: 'Team Sales Report',
          description: 'Compare sales performance across your team.',
          icon: TrendingUp,
        },
        {
          href: '/dashboard/crm/sales-crm/client-performance-report',
          label: 'Client Performance Report',
          description: 'Top clients by revenue, frequency, and recency.',
          icon: LineChart,
        },
      ]}
    />
  );
}
