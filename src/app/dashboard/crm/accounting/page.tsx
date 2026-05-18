import { ZoruCard, ZoruPageDescription, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  FileBarChart,
  FileSpreadsheet,
  LineChart,
  Scale,
  ScrollText,
  TrendingUp,
  Wallet,
  } from 'lucide-react';

/**
 * Accounting module overview — tile grid linking every sub-feature.
 *
 * Was a `redirect('/dashboard/crm/accounting/charts')` shim.
 */

import Link from 'next/link';

interface NavTile {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tiles: NavTile[] = [
  { href: '/dashboard/crm/accounting/charts', title: 'Chart of Accounts', description: 'Your accounting tree — every ledger account you post to.', icon: BookOpen },
  { href: '/dashboard/crm/accounting/groups', title: 'Account Groups', description: 'Group accounts by category for cleaner reports.', icon: FileSpreadsheet },
  { href: '/dashboard/crm/accounting/vouchers', title: 'Vouchers', description: 'Manual journal entries and accounting vouchers.', icon: ScrollText },
  { href: '/dashboard/crm/accounting/day-book', title: 'Day Book', description: 'Chronological log of every accounting entry.', icon: CalendarDays },
  { href: '/dashboard/crm/accounting/trial-balance', title: 'Trial Balance', description: 'Debit/credit summary across every account.', icon: Scale },
  { href: '/dashboard/crm/accounting/pnl', title: 'Profit & Loss', description: 'Income vs expense over a period.', icon: TrendingUp },
  { href: '/dashboard/crm/accounting/income-statement', title: 'Income Statement', description: 'Detailed P&L by account class.', icon: LineChart },
  { href: '/dashboard/crm/accounting/balance-sheet', title: 'Balance Sheet', description: 'Assets, liabilities, and equity at a point in time.', icon: FileBarChart },
  { href: '/dashboard/crm/accounting/cash-flow', title: 'Cash Flow', description: 'Cash movements across operating, investing, financing.', icon: Wallet },
];

export default function CrmAccountingHubPage() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Accounting</ZoruPageTitle>
          <ZoruPageDescription>
            Books, vouchers, and the four primary financial reports.
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
