/**
 * SabCheckout sessions log — `/dashboard/sabcheckout/sessions`.
 *
 * Read-only table of payer sessions across all pages owned by the
 * signed-in user. Filterable by status.
 */
import { Activity, Search, Filter, ExternalLink, Download, FileText } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  Input,
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
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Sessions</ZoruPageTitle>
            <ZoruPageDescription>
              Every checkout attempt across all your pages.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </PageHeader>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {!res.ok ? (
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Couldn't load sessions</ZoruCardTitle>
            <ZoruCardDescription>{res.error}</ZoruCardDescription>
          </ZoruCardHeader>
        </Card>
      ) : (
        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-zoru-line bg-zoru-surface p-4">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
                <Input
                  type="search"
                  placeholder="Search sessions by payer or reference..."
                  className="w-80 pl-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filter by Status
              </Button>
            </div>
          </div>
          
          <ZoruCardContent className="p-0">
            {res.data.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface-2 text-zoru-ink-muted mb-4">
                  <Activity className="h-6 w-6" />
                </div>
                <ZoruCardTitle className="text-lg">No sessions yet</ZoruCardTitle>
                <ZoruCardDescription className="max-w-sm mt-2">
                  When users visit your payment pages and initiate checkout, those sessions will appear here.
                </ZoruCardDescription>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zoru-surface-hover/50 text-zoru-ink-subtle uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 font-medium">Payer</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Amount</th>
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zoru-line">
                    {res.data.items.map((s) => (
                      <tr
                        key={s._id}
                        className="group hover:bg-zoru-surface-hover/30 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="min-w-0">
                            <span className="truncate text-[15px] font-medium text-zoru-ink block">
                              {s.payerName ?? s.payerEmail ?? 'Anonymous payer'}
                            </span>
                            <span className="truncate text-[13px] text-zoru-ink-muted block mt-0.5">
                              {s.payerEmail ?? 'No email provided'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge 
                            variant={s.status === 'completed' ? 'default' : s.status === 'failed' ? 'destructive' : 'secondary'}
                            className="h-5 text-[11px] capitalize"
                          >
                            {s.status}
                          </Badge>
                          {s.paymentRef && (
                            <div className="text-[11px] font-mono text-zoru-ink-muted mt-1.5 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {s.paymentRef}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold tabular-nums text-zoru-ink">
                            <span className="uppercase text-zoru-ink-muted text-xs mr-1">{s.totals.currency}</span>
                            {(s.totals.totalMinor / 100).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-zoru-ink-muted">
                          {s.createdAt
                            ? new Date(s.createdAt).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            View Session <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ZoruCardContent>
        </Card>
      )}
    </div>
  );
}
