import {
  FileText,
  BookOpen,
  Scale,
  TrendingUp,
  BarChart3,
  ArrowLeftRight,
  Network,
  Layers,
  Receipt,
} from 'lucide-react';

import { CrmModuleOverview } from '../_components/crm-module-overview';

export default function AccountingOverviewPage() {
  return (
    <CrmModuleOverview
      title="Accounting"
      subtitle="Ledgers, vouchers, and financial statements — your complete books of accounts."
      icon={FileText}
      sections={[
        {
          href: '/dashboard/crm/accounting/day-book',
          label: 'Day Book',
          description: 'Chronological record of every transaction posted.',
          icon: BookOpen,
        },
        {
          href: '/dashboard/crm/accounting/vouchers',
          label: 'Vouchers',
          description: 'Journal, payment, receipt, and contra vouchers.',
          icon: Receipt,
        },
        {
          href: '/dashboard/crm/accounting/charts',
          label: 'Chart of Accounts',
          description: 'Hierarchical structure of every ledger account.',
          icon: Network,
        },
        {
          href: '/dashboard/crm/accounting/groups',
          label: 'Account Groups',
          description: 'Group ledgers for reporting and classification.',
          icon: Layers,
        },
        {
          href: '/dashboard/crm/accounting/trial-balance',
          label: 'Trial Balance',
          description: 'Verify that debits equal credits before closing.',
          icon: Scale,
        },
        {
          href: '/dashboard/crm/accounting/income-statement',
          label: 'Income Statement',
          description: 'Profit and loss over a chosen period.',
          icon: TrendingUp,
        },
        {
          href: '/dashboard/crm/accounting/balance-sheet',
          label: 'Balance Sheet',
          description: 'Assets, liabilities, and equity at a point in time.',
          icon: BarChart3,
        },
        {
          href: '/dashboard/crm/accounting/cash-flow',
          label: 'Cash Flow',
          description: 'Inflows and outflows across operating activities.',
          icon: ArrowLeftRight,
        },
        {
          href: '/dashboard/crm/accounting/pnl',
          label: 'P&L Summary',
          description: 'Quick profit and loss summary.',
          icon: TrendingUp,
        },
      ]}
    />
  );
}
