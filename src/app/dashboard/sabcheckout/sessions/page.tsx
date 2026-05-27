/**
 * SabCheckout sessions log — `/dashboard/sabcheckout/sessions`.
 *
 * Read-only table of payer sessions across all pages owned by the
 * signed-in user. Filterable by status.
 */
import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
} from '@/components/zoruui';

import { listSabcheckoutSessions } from '@/app/actions/sabcheckout.actions';
import type { SabcheckoutSessionStatus } from '@/lib/rust-client/sabcheckout-sessions';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: SabcheckoutSessionStatus | 'all';
  page?: string;
}

export default async function SabcheckoutSessionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const res = await listSabcheckoutSessions({
    status: sp.status,
    page: Number.parseInt(sp.page ?? '0', 10) || 0,
    limit: 50,
  });

  return (
    <div className="zoruui space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
        <p className="text-sm text-[var(--zoru-muted-fg)]">
          Every checkout attempt across all your pages.
        </p>
      </header>

      {!res.ok ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Couldn't load sessions</ZoruCardTitle>
            <ZoruCardDescription>{res.error}</ZoruCardDescription>
          </ZoruCardHeader>
        </Card>
      ) : (
        <Card>
          <ZoruCardContent className="p-0">
            {res.data.items.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--zoru-muted-fg)]">
                No sessions yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--zoru-border)]">
                {res.data.items.map((s) => (
                  <li
                    key={s._id}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {s.payerName ?? s.payerEmail ?? 'Anonymous payer'}
                        </span>
                        <Badge variant="secondary">{s.status}</Badge>
                      </div>
                      <p className="truncate text-xs text-[var(--zoru-muted-fg)]">
                        {s.payerEmail ?? ''}
                        {s.paymentRef ? ` · ref ${s.paymentRef}` : ''}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums">
                      {s.totals.currency}{' '}
                      {(s.totals.totalMinor / 100).toFixed(2)}
                    </span>
                    <span className="text-xs text-[var(--zoru-muted-fg)]">
                      {s.createdAt
                        ? new Date(s.createdAt).toLocaleString()
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ZoruCardContent>
        </Card>
      )}
    </div>
  );
}
