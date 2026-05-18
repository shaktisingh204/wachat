import { ZoruCard, ZoruPageDescription, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import {
  ArrowUpRight,
  Banknote,
  Briefcase,
  ClipboardList,
  Coins,
  FileMinus,
  HandCoins,
  Receipt,
  Repeat,
  ShoppingBag,
  Store,
  TrendingDown,
  } from 'lucide-react';

/**
 * Purchases module overview — tile grid linking every sub-feature.
 *
 * Was a `redirect('/dashboard/crm/purchases/vendors')` shim.
 */

import Link from 'next/link';

interface NavTile {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tiles: NavTile[] = [
  { href: '/dashboard/crm/purchases/vendors', title: 'Vendors', description: 'Suppliers you buy goods and services from.', icon: Store },
  { href: '/dashboard/crm/purchases/leads', title: 'Vendor Leads', description: 'Prospective vendors you are evaluating.', icon: TrendingDown },
  { href: '/dashboard/crm/purchases/rfqs', title: 'RFQs', description: 'Requests-for-quote sent to vendors.', icon: ClipboardList },
  { href: '/dashboard/crm/purchases/vendor-bids', title: 'Vendor Bids', description: 'Bids received from vendors in response to RFQs.', icon: HandCoins },
  { href: '/dashboard/crm/purchases/orders', title: 'Purchase Orders', description: 'Confirmed orders placed with vendors.', icon: ShoppingBag },
  { href: '/dashboard/crm/purchases/expenses', title: 'Expenses', description: 'Day-to-day operational spending.', icon: Coins },
  { href: '/dashboard/crm/purchases/recurring-expenses', title: 'Recurring Expenses', description: 'Subscriptions, rent, and other repeating bills.', icon: Repeat },
  { href: '/dashboard/crm/purchases/payouts', title: 'Payouts', description: 'Money paid out to vendors and contractors.', icon: Banknote },
  { href: '/dashboard/crm/purchases/debit-notes', title: 'Debit Notes', description: 'Adjustments and returns to vendors.', icon: FileMinus },
  { href: '/dashboard/crm/purchases/hire', title: 'Hire', description: 'Contractor and short-term hire arrangements.', icon: Briefcase },
];

export default function CrmPurchasesHubPage() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Purchases</ZoruPageTitle>
          <ZoruPageDescription>
            Vendors, purchase orders, expenses, and supplier payments.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.href} href={tile.href} className="group">
              <ZoruCard className="h-full p-5 transition-shadow group-hover:shadow-[var(--zoru-shadow-md)]">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium text-zoru-ink">{tile.title}</p>
                  <ArrowUpRight className="h-4 w-4 text-zoru-ink-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-zoru-ink" />
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-zoru-ink-muted">
                  {tile.description}
                </p>
              </ZoruCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
