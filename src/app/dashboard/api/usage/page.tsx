import {
  getUsageSummary,
  getUsageTop,
  getUsageByKey,
} from '@/app/actions/developer-platform.actions';
import {
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
  Breadcrumb,
  ZoruBreadcrumbList,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbSeparator,
  ZoruBreadcrumbPage,
  Card,
  StatCard,
  Table,
  ZoruTableHeader,
  ZoruTableHead,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableCell,
} from '@/components/sabcrm/20ui/compat';
import Link from 'next/link';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

function pct(n: number, d: number): string {
  if (!d) return '0%';
  return `${((n / d) * 100).toFixed(1)}%`;
}

export default async function UsagePage(): Promise<JSX.Element> {
  const [summaryRes, topRes, keysRes] = await Promise.all([
    getUsageSummary(),
    getUsageTop({ limit: 15 }),
    getUsageByKey(),
  ]);

  if (!summaryRes.success) {
    throw new Error(summaryRes.error || 'Failed to fetch usage summary');
  }
  if (!topRes.success) {
    throw new Error(topRes.error || 'Failed to fetch top endpoints');
  }
  if (!keysRes.success) {
    throw new Error(keysRes.error || 'Failed to fetch usage by key');
  }

  return (
    <div className="flex min-h-full flex-col gap-6">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/api">Developer platform</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Usage analytics</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Usage analytics</ZoruPageTitle>
          <ZoruPageDescription>
            Aggregated over the last 24 hours. Raw entries live in{' '}
            <Link href="/dashboard/api/logs" className="underline underline-offset-2">
              /dashboard/api/logs
            </Link>.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total requests" value={summaryRes.totalRequests.toLocaleString('en-US')} />
        <StatCard
          label="Errors"
          value={`${summaryRes.errorRequests.toLocaleString('en-US')} (${pct(summaryRes.errorRequests, summaryRes.totalRequests)})`}
        />
        <StatCard label="Avg latency" value={`${Math.round(summaryRes.avgLatencyMs)} ms`} />
        <StatCard label="p95 latency" value={`${Math.round(summaryRes.p95LatencyMs)} ms`} />
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zoru-ink">Top endpoints</h2>
        <Card>
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Endpoint</ZoruTableHead>
                <ZoruTableHead>Requests</ZoruTableHead>
                <ZoruTableHead>Errors</ZoruTableHead>
                <ZoruTableHead>Avg latency</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {topRes.rows.length > 0 ? (
                topRes.rows.map((r, i) => (
                  <ZoruTableRow key={i}>
                    <ZoruTableCell className="font-mono text-xs text-zoru-ink">
                      {r.method} {r.path}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">{r.count.toLocaleString('en-US')}</ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink-muted text-xs">
                      {r.errorCount} ({pct(r.errorCount, r.count)})
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink-muted text-xs">{Math.round(r.avgLatencyMs)} ms</ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : (
                <ZoruTableRow>
                  <ZoruTableCell colSpan={4} className="text-center text-zoru-ink-muted py-6 text-sm">
                    No data yet for the selected window.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-zoru-ink">By key</h2>
        <Card>
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Key id</ZoruTableHead>
                <ZoruTableHead>Type</ZoruTableHead>
                <ZoruTableHead>Env</ZoruTableHead>
                <ZoruTableHead>Requests</ZoruTableHead>
                <ZoruTableHead>Errors</ZoruTableHead>
                <ZoruTableHead>Last used</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {keysRes.rows.length > 0 ? (
                keysRes.rows.map((r) => (
                  <ZoruTableRow key={r.keyId}>
                    <ZoruTableCell className="font-mono text-xs text-zoru-ink">{r.keyId}</ZoruTableCell>
                    <ZoruTableCell className="text-xs text-zoru-ink-muted">{r.kind}</ZoruTableCell>
                    <ZoruTableCell className="text-xs text-zoru-ink-muted">{r.env}</ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink">{r.count.toLocaleString('en-US')}</ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink-muted">{r.errorCount}</ZoruTableCell>
                    <ZoruTableCell className="text-xs text-zoru-ink-muted">
                      {r.lastUsedAt ? format(new Date(r.lastUsedAt), 'MMM d, yyyy HH:mm') : '—'}
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : (
                <ZoruTableRow>
                  <ZoruTableCell colSpan={6} className="text-center text-zoru-ink-muted py-6 text-sm">
                    No data yet.
                  </ZoruTableCell>
                </ZoruTableRow>
              )}
            </ZoruTableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
