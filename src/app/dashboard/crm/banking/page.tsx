import {
  Landmark,
  CreditCard,
  ArrowLeftRight,
  Users,
  GitCompare,
} from 'lucide-react';

import { CrmModuleOverview } from '../_components/crm-module-overview';

export default function BankingOverviewPage() {
  return (
    <CrmModuleOverview
      title="Banking"
      subtitle="Bank accounts, transactions, and reconciliation."
      icon={Landmark}
      sections={[
        {
          href: '/dashboard/crm/banking/bank-accounts',
          label: 'Bank Accounts',
          description: 'Add and manage your business bank accounts.',
          icon: CreditCard,
        },
        {
          href: '/dashboard/crm/banking/all',
          label: 'All Transactions',
          description: 'Every banking transaction in one ledger.',
          icon: ArrowLeftRight,
        },
        {
          href: '/dashboard/crm/banking/employee-accounts',
          label: 'Employee Accounts',
          description: 'Employee bank details for payroll disbursement.',
          icon: Users,
        },
        {
          href: '/dashboard/crm/banking/reconciliation',
          label: 'Reconciliation',
          description: 'Match bank statements against book entries.',
          icon: GitCompare,
        },
      ]}
    />
  );
}
