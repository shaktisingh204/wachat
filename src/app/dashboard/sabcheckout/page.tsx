/**
 * SabCheckout admin home — `/dashboard/sabcheckout`.
 *
 * Lists every payment page owned by the signed-in user with a "+ New
 * page" CTA. Server component; reads via the Rust BFF.
 */
import Link from 'next/link';
import { Plus } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
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

  return (
    <div className="zoruui space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SabCheckout</h1>
          <p className="text-sm text-[var(--zoru-muted-fg)]">
            Build branded, shareable payment pages. One-off or recurring.
          </p>
        </div>
        <Link href="/dashboard/sabcheckout/new">
          <Button>
            <Plus className="mr-2 size-4" />
            New page
          </Button>
        </Link>
      </header>

      {!result.ok ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Couldn't load pages</ZoruCardTitle>
            <ZoruCardDescription>{result.error}</ZoruCardDescription>
          </ZoruCardHeader>
        </Card>
      ) : result.data.items.length === 0 ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>No payment pages yet</ZoruCardTitle>
            <ZoruCardDescription>
              Create your first SabCheckout page to start collecting payments.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <Link href="/dashboard/sabcheckout/new">
              <Button>
                <Plus className="mr-2 size-4" />
                New page
              </Button>
            </Link>
          </ZoruCardContent>
        </Card>
      ) : (
        <SabcheckoutPagesListClient
          items={result.data.items}
          page={result.data.page}
          hasMore={result.data.hasMore}
        />
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/dashboard/sabcheckout/plans">
          <Badge variant="secondary">Plans</Badge>
        </Link>
        <Link href="/dashboard/sabcheckout/sessions">
          <Badge variant="secondary">Sessions</Badge>
        </Link>
        <Link href="/dashboard/sabcheckout/customers">
          <Badge variant="secondary">Customers</Badge>
        </Link>
        <Link href="/dashboard/sabcheckout/subscriptions">
          <Badge variant="secondary">Subscriptions</Badge>
        </Link>
      </div>
    </div>
  );
}
