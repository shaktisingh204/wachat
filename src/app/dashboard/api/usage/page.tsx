import {
  getUsageSummary,
  getUsageTop,
  getUsageByKey,
} from '@/app/actions/developer-platform.actions';
import {
  PageHeader,
  PageHeading,
  PageTitle,
  PageDescription,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
  Card,
  StatCard,
  Badge,
  EmptyState,
  Table,
  THead,
  Th,
  TBody,
  Tr,
  Td,
} from '@/components/sabcrm/20ui';
import { Inbox } from 'lucide-react';
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
    <div className="ui20 flex min-h-full flex-col gap-6">
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
            </Link>
            .
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        <Card padding="none">
          {topRes.rows.length > 0 ? (
            <Table>
              <THead>
                <Tr>
                  <Th>Endpoint</Th>
                  <Th align="right">Requests</Th>
                  <Th align="right">Errors</Th>
                  <Th align="right">Avg latency</Th>
                </Tr>
              </THead>
              <TBody>
                {topRes.rows.map((r, i) => (
                  <Tr key={i}>
                    <Td className="font-mono text-xs text-[var(--st-text)]">
                      {r.method} {r.path}
                    </Td>
                    <Td align="right" className="text-[var(--st-text)]">
                      {r.count.toLocaleString('en-US')}
                    </Td>
                    <Td align="right" className="text-xs text-[var(--st-text-secondary)]">
                      {r.errorCount} ({pct(r.errorCount, r.count)})
                    </Td>
                    <Td align="right" className="text-xs text-[var(--st-text-secondary)]">
                      {Math.round(r.avgLatencyMs)} ms
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No data yet"
              description="No requests in the selected window. Endpoint activity will appear here."
            />
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--st-text)]">By key</h2>
        <Card padding="none">
          {keysRes.rows.length > 0 ? (
            <Table>
              <THead>
                <Tr>
                  <Th>Key id</Th>
                  <Th>Type</Th>
                  <Th>Env</Th>
                  <Th align="right">Requests</Th>
                  <Th align="right">Errors</Th>
                  <Th>Last used</Th>
                </Tr>
              </THead>
              <TBody>
                {keysRes.rows.map((r) => (
                  <Tr key={r.keyId}>
                    <Td className="font-mono text-xs text-[var(--st-text)]">{r.keyId}</Td>
                    <Td>
                      <Badge tone="neutral">{r.kind}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={r.env === 'live' ? 'success' : 'info'}>{r.env}</Badge>
                    </Td>
                    <Td align="right" className="text-[var(--st-text)]">
                      {r.count.toLocaleString('en-US')}
                    </Td>
                    <Td align="right" className="text-[var(--st-text-secondary)]">
                      {r.errorCount}
                    </Td>
                    <Td className="text-xs text-[var(--st-text-secondary)]">
                      {r.lastUsedAt ? format(new Date(r.lastUsedAt), 'MMM d, yyyy HH:mm') : 'Never'}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No data yet"
              description="No keys have made requests. Per-key usage will appear here."
            />
          )}
        </Card>
      </section>
    </div>
  );
}
