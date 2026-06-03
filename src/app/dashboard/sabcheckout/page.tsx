/**
 * SabCheckout admin home — `/dashboard/sabcheckout`.
 *
 * Lists every payment page owned by the signed-in user with a "+ New
 * page" CTA. Server component; reads via the Rust BFF.
 */
import Link from 'next/link';
import { Plus, LayoutDashboard, CreditCard, Activity, Package, ArrowUpRight, ArrowDownRight } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  StatCard
} from '@/components/zoruui';

import { listSabcheckoutPages } from '@/app/actions/sabcheckout.actions';
import type { SabcheckoutPageStatus } from '@/lib/rust-client/sabcheckout-pages';
import { SabcheckoutPagesListClient } from './_components/sabcheckout-pages-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  q?: string;
  status?: SabcheckoutPageStatus | 'all';
}

export default async function SabcheckoutHomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Number.parseInt(sp.page ?? '0', 10) || 0;
  const result = await listSabcheckoutPages({
    page,
    limit: 20,
    q: sp.q,
    status: sp.status,
  });

  // Mock stats for demo purposes
  const stats = [
    { label: 'Total Revenue', value: '$12,450', delta: 15.2, period: 'vs last month', icon: <CreditCard /> },
    { label: 'Active Pages', value: result.ok ? result.data.items.length.toString() : '0', delta: 4.1, period: 'vs last month', icon: <Package /> },
    { label: 'Conversion Rate', value: '3.4%', delta: -1.2, period: 'vs last month', icon: <Activity /> },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Overview</ZoruPageTitle>
            <ZoruPageDescription>
              Build branded, shareable payment pages. One-off or recurring.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <Link href="/dashboard/sabcheckout/new">
          <Button>
            <Plus className="mr-2 size-4" />
            New payment page
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat, i) => (
          <StatCard
            key={i}
            label={stat.label}
            value={stat.value}
            delta={stat.delta}
            period={stat.period}
            icon={stat.icon}
          />
        ))}
      </div>

      <div className="mt-4">
        <h3 className="mb-4 text-lg font-medium tracking-tight text-zoru-ink">Your Pages</h3>
        {!result.ok ? (
          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Couldn't load pages</ZoruCardTitle>
              <ZoruCardDescription>{result.error}</ZoruCardDescription>
            </ZoruCardHeader>
          </Card>
        ) : result.data.items.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted mb-4">
              <Package className="h-6 w-6" />
            </div>
            <ZoruCardTitle className="text-xl">No payment pages yet</ZoruCardTitle>
            <ZoruCardDescription className="max-w-sm mt-2 mb-6">
              Create your first SabCheckout page to start collecting payments.
            </ZoruCardDescription>
            <Link href="/dashboard/sabcheckout/new">
              <Button>
                <Plus className="mr-2 size-4" />
                Create your first page
              </Button>
            </Link>
          </Card>
        ) : (
          <SabcheckoutPagesListClient
            items={result.data.items}
            page={result.data.page}
            hasMore={result.data.hasMore}
          />
        )}
      </div>
    </div>
  );
}
