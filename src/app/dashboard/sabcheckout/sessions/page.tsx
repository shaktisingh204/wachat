/**
 * SabCheckout sessions log - `/dashboard/sabcheckout/sessions`.
 *
 * Read-only table of payer sessions across all pages owned by the
 * signed-in user. Filterable by status.
 */
import { Activity, Search, Filter, ExternalLink, Download, FileText } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
  Input,
  PageHeader,
  PageHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  type BadgeTone,
} from '@/components/sabcrm/20ui';

import { listSabcheckoutSessions } from '@/app/actions/sabcheckout.actions';
import type { SabcheckoutSessionStatus } from '@/lib/rust-client/sabcheckout-sessions';

export const dynamic = 'force-dynamic';

interface SearchParams {
  status?: SabcheckoutSessionStatus | 'all';
  page?: string;
}

/** Map a session status to a 20ui Badge tone (colour only carries meaning). */
function statusTone(status: SabcheckoutSessionStatus): BadgeTone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
    case 'expired':
      return 'danger';
    case 'pending':
      return 'warning';
    default:
      return 'neutral';
  }
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
      <PageHeader>
        <PageHeading>
          <PageTitle>Sessions</PageTitle>
          <PageDescription>
            Every checkout attempt across all your pages.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button variant="outline" iconLeft={Download}>
            Export CSV
          </Button>
        </PageActions>
      </PageHeader>

      {!res.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>Couldn&apos;t load sessions</CardTitle>
            <CardDescription>{res.error}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card padding="none" className="flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
            <Input
              type="search"
              iconLeft={Search}
              placeholder="Search sessions by payer or reference..."
              aria-label="Search sessions by payer or reference"
              className="w-80"
            />
            <Button variant="outline" size="sm" iconLeft={Filter}>
              Filter by Status
            </Button>
          </div>

          <CardBody className="p-0">
            {res.data.items.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No sessions yet"
                description="When users visit your payment pages and initiate checkout, those sessions will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Payer</Th>
                      <Th>Status</Th>
                      <Th>Amount</Th>
                      <Th>Date</Th>
                      <Th align="right">Details</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {res.data.items.map((s) => (
                      <Tr key={s._id} className="group">
                        <Td>
                          <div className="min-w-0">
                            <span className="block truncate text-[15px] font-medium text-[var(--st-text)]">
                              {s.payerName ?? s.payerEmail ?? 'Anonymous payer'}
                            </span>
                            <span className="mt-0.5 block truncate text-[13px] text-[var(--st-text-secondary)]">
                              {s.payerEmail ?? 'No email provided'}
                            </span>
                          </div>
                        </Td>
                        <Td>
                          <Badge tone={statusTone(s.status)} className="capitalize">
                            {s.status}
                          </Badge>
                          {s.paymentRef && (
                            <div className="mt-1.5 flex items-center gap-1 font-mono text-[11px] text-[var(--st-text-secondary)]">
                              <FileText className="h-3 w-3" aria-hidden="true" />
                              {s.paymentRef}
                            </div>
                          )}
                        </Td>
                        <Td>
                          <span className="text-sm font-semibold tabular-nums text-[var(--st-text)]">
                            <span className="mr-1 text-xs uppercase text-[var(--st-text-secondary)]">
                              {s.totals.currency}
                            </span>
                            {(s.totals.totalMinor / 100).toFixed(2)}
                          </span>
                        </Td>
                        <Td className="text-[var(--st-text-secondary)]">
                          {s.createdAt
                            ? new Date(s.createdAt).toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Unknown'}
                        </Td>
                        <Td align="right">
                          <Button
                            variant="ghost"
                            size="sm"
                            iconRight={ExternalLink}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            View Session
                          </Button>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
