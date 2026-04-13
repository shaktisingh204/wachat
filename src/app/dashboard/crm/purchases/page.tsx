import {
  ShoppingBag,
  Truck,
  Wallet,
  FileMinus,
  ArrowUpRight,
  Target,
  UserPlus,
} from 'lucide-react';

import { CrmModuleOverview } from '../_components/crm-module-overview';

export default function PurchasesOverviewPage() {
  return (
    <CrmModuleOverview
      title="Purchases"
      subtitle="Vendors, purchase orders, expenses, debit notes, and payouts."
      icon={ShoppingBag}
      sections={[
        {
          href: '/dashboard/crm/purchases/vendors',
          label: 'Vendors & Suppliers',
          description: 'Vendor directory with contact and tax details.',
          icon: Truck,
        },
        {
          href: '/dashboard/crm/purchases/orders',
          label: 'Purchase Orders',
          description: 'Create and track purchase orders to vendors.',
          icon: ShoppingBag,
        },
        {
          href: '/dashboard/crm/purchases/expenses',
          label: 'Expenses',
          description: 'Record operating and capital expenses.',
          icon: Wallet,
        },
        {
          href: '/dashboard/crm/purchases/debit-notes',
          label: 'Debit Notes',
          description: 'Issue debit notes for returns or price adjustments.',
          icon: FileMinus,
        },
        {
          href: '/dashboard/crm/purchases/payouts',
          label: 'Payouts',
          description: 'Money paid out against purchase invoices.',
          icon: ArrowUpRight,
        },
        {
          href: '/dashboard/crm/purchases/leads',
          label: 'Purchase Leads',
          description: 'Track sourcing leads and vendor negotiations.',
          icon: Target,
        },
        {
          href: '/dashboard/crm/purchases/hire',
          label: 'Hire & Services',
          description: 'Manage hiring of contract services and gear.',
          icon: UserPlus,
        },
      ]}
    />
  );
}
