import {
  getUsageSummary,
  getUsageTop,
  getUsageByKey,
} from '@/app/actions/developer-platform.actions';
import { PageHeader, PageHeading, PageTitle, PageDescription, Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage, Card, StatCard, Table, THead, Th, TBody, Tr, Td } from '@/components/sabcrm/20ui';
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
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/api">Developer platform</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Usage analytics</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <PageTitle>Usage analytics</PageTitle>
          <PageDescription>
            Aggregated over the last 24 hours. Raw entries live in{' '}
            <Link href="/dashboard/api/logs" className="underline underline-offset-2">
              /dashboard/api/logs
            </Link>.
          </PageDescription>
        </PageHeading>
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
        <h2 className="text-base font-semibold text-[var(--st-text)]">Top endpoints</h2>
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>Endpoint</Th>
                <Th>Requests</Th>
                <Th>Errors</Th>
                <Th>Avg latency</Th>
              </Tr>
            </THead>
            <TBody>
              {topRes.rows.length > 0 ? (
                topRes.rows.map((r, i) => (
                  <Tr key={i}>
                    <Td className="font-mono text-xs text-[var(--st-text)]">
                      {r.method} {r.path}
                    </Td>
                    <Td className="text-[var(--st-text)]">{r.count.toLocaleString('en-US')}</Td>
                    <Td className="text-[var(--st-text-secondary)] text-xs">
                      {r.errorCount} ({pct(r.errorCount, r.count)})
                    </Td>
                    <Td className="text-[var(--st-text-secondary)] text-xs">{Math.round(r.avgLatencyMs)} ms</Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={4} className="text-center text-[var(--st-text-secondary)] py-6 text-sm">
                    No data yet for the selected window.
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--st-text)]">By key</h2>
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>Key id</Th>
                <Th>Type</Th>
                <Th>Env</Th>
                <Th>Requests</Th>
                <Th>Errors</Th>
                <Th>Last used</Th>
              </Tr>
            </THead>
            <TBody>
              {keysRes.rows.length > 0 ? (
                keysRes.rows.map((r) => (
                  <Tr key={r.keyId}>
                    <Td className="font-mono text-xs text-[var(--st-text)]">{r.keyId}</Td>
                    <Td className="text-xs text-[var(--st-text-secondary)]">{r.kind}</Td>
                    <Td className="text-xs text-[var(--st-text-secondary)]">{r.env}</Td>
                    <Td className="text-[var(--st-text)]">{r.count.toLocaleString('en-US')}</Td>
                    <Td className="text-[var(--st-text-secondary)]">{r.errorCount}</Td>
                    <Td className="text-xs text-[var(--st-text-secondary)]">
                      {r.lastUsedAt ? format(new Date(r.lastUsedAt), 'MMM d, yyyy HH:mm') : '—'}
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={6} className="text-center text-[var(--st-text-secondary)] py-6 text-sm">
                    No data yet.
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
