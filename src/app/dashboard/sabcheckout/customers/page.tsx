/**
 * SabCheckout customers index — `/dashboard/sabcheckout/customers`.
 *
 * Recurring-customer roll-up: one row per (page, external customer)
 * pair created during the subscription confirm path.
 */
import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
} from '@/components/zoruui';

import { listSabcheckoutCustomers } from '@/app/actions/sabcheckout.actions';

export const dynamic = 'force-dynamic';

export default async function SabcheckoutCustomersPage() {
  const res = await listSabcheckoutCustomers({ limit: 100 });

  return (
    <div className="zoruui space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-[var(--zoru-muted-fg)]">
          Recurring customers indexed across all your payment pages.
        </p>
      </header>

      {!res.ok ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Couldn't load customers</ZoruCardTitle>
            <ZoruCardDescription>{res.error}</ZoruCardDescription>
          </ZoruCardHeader>
        </Card>
      ) : (
        <Card>
          <ZoruCardContent className="p-0">
            {res.data.items.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--zoru-muted-fg)]">
                No recurring customers yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--zoru-border)]">
                {res.data.items.map((c) => (
                  <li
                    key={c._id}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3"
                  >
                    <div>
                      <p className="truncate text-sm font-medium">
                        {c.name ?? c.email}
                      </p>
                      <p className="truncate text-xs text-[var(--zoru-muted-fg)]">
                        {c.email}
                        {c.phone ? ` · ${c.phone}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-[var(--zoru-muted-fg)]">
                      {c.subscriptionIds?.length ?? 0} sub(s)
                    </span>
                    <span className="text-xs text-[var(--zoru-muted-fg)]">
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleDateString()
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
