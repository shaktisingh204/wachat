import { ZoruCard, ZoruPageDescription, ZoruPageHeader, ZoruPageHeading, ZoruPageTitle } from '@/components/zoruui';
import {
  ArrowUpRight,
  Banknote,
  Landmark,
  RefreshCcw,
  Repeat,
  UserCircle } from 'lucide-react';

/**
 * Banking module overview — tile grid linking every sub-feature.
 *
 * Was a `redirect('/dashboard/crm/banking/all')` shim.
 */

import Link from 'next/link';

interface NavTile {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tiles: NavTile[] = [
  { href: '/dashboard/crm/banking/all', title: 'All Banking', description: 'Combined view of every bank account and transaction.', icon: Banknote },
  { href: '/dashboard/crm/banking/bank-accounts', title: 'Bank Accounts', description: 'Company bank accounts and their balances.', icon: Landmark },
  { href: '/dashboard/crm/banking/bank-transactions', title: 'Bank Transactions', description: 'Statement transactions imported from your banks.', icon: Repeat },
  { href: '/dashboard/crm/banking/employee-accounts', title: 'Employee Accounts', description: 'Employee payout / reimbursement accounts.', icon: UserCircle },
  { href: '/dashboard/crm/banking/reconciliation', title: 'Reconciliation', description: 'Match statement lines against booked entries.', icon: RefreshCcw },
];

export default function CrmBankingHubPage() {
  return (
    <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Banking</ZoruPageTitle>
          <ZoruPageDescription>
            Bank accounts, statements, and reconciliation against your books.
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
