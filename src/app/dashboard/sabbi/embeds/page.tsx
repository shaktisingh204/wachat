/**
 * Embeds list — public share tokens for workbooks.
 *
 * Real data via `listEmbedsAction` (Rust `sabbi-embeds`). Each embed resolves a
 * workbook + its charts at the anonymous public route `/embed/bi/[token]`.
 * (Signed-JWT + per-tenant RLS hardening lands in the BI program's P9.)
 */
import Link from 'next/link';
import {
  Code2,
  ExternalLink,
  Globe,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import {
  listEmbedsAction,
  listWorkbooksAction,
} from '@/app/actions/analytics-bi.actions';

export const dynamic = 'force-dynamic';

export default async function EmbedsPage() {
  let embeds: Awaited<ReturnType<typeof listEmbedsAction>>['items'] = [];
  let workbooks: Awaited<ReturnType<typeof listWorkbooksAction>>['items'] = [];
  try {
    const [e, w] = await Promise.all([
      listEmbedsAction({ limit: 200 }),
      listWorkbooksAction({ limit: 200 }),
    ]);
    embeds = e.items;
    workbooks = w.items;
  } catch {
    embeds = [];
    workbooks = [];
  }

  const workbookName = new Map(workbooks.map((w) => [w._id, w.name]));
  const activeCount = embeds.filter((e) => e.status === 'active').length;

  return (
    <div className="20ui flex flex-col gap-[var(--st-space-5)] p-[var(--st-space-5)]">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBI</PageEyebrow>
          <PageTitle>Embeds &amp; sharing</PageTitle>
          <PageDescription>
            Publish a workbook to an external page via a public token. Domain
            allow-listing keeps each embed scoped to where you host it.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="ghost" asChild>
            <Link href="/dashboard/sabbi/workbooks">
              <LayoutDashboard size={16} aria-hidden="true" />
              Workbooks
            </Link>
          </Button>
        </PageActions>
      </PageHeader>

      <div className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-3">
        <StatCard
          label="Embeds"
          value={embeds.length}
          icon={Code2}
          accent="var(--st-accent)"
        />
        <StatCard label="Active" value={activeCount} icon={ShieldCheck} />
        <StatCard label="Workbooks" value={workbooks.length} icon={LayoutDashboard} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 size={16} aria-hidden="true" />
            Embed links
          </CardTitle>
        </CardHeader>
        <CardBody>
          {embeds.length === 0 ? (
            <EmptyState
              icon={Code2}
              tone="info"
              title="No embeds yet"
              description="Open a workbook and create an embed to share it on an external page."
            />
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th align="left">Workbook</Th>
                  <Th align="left">Status</Th>
                  <Th align="left">Allowed origins</Th>
                  <Th align="left">Public link</Th>
                </Tr>
              </THead>
              <TBody>
                {embeds.map((e) => (
                  <Tr key={e._id}>
                    <Td>
                      <Link
                        href={`/dashboard/sabbi/workbooks/${e.workbookId}`}
                        className="font-medium text-[var(--st-text)] hover:underline"
                      >
                        {workbookName.get(e.workbookId) ?? 'Workbook'}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={e.status === 'active' ? 'success' : 'neutral'}>
                        {e.status}
                      </Badge>
                    </Td>
                    <Td className="text-[var(--st-text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <Globe size={13} aria-hidden="true" />
                        {e.allowOrigins.length > 0
                          ? `${e.allowOrigins.length} origin${e.allowOrigins.length === 1 ? '' : 's'}`
                          : 'Any'}
                      </span>
                    </Td>
                    <Td>
                      {e.status === 'active' ? (
                        <Link
                          href={`/embed/bi/${e.token}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-[var(--st-accent)] hover:underline"
                        >
                          Open
                          <ExternalLink size={13} aria-hidden="true" />
                        </Link>
                      ) : (
                        <span className="text-[var(--st-text-secondary)]">Revoked</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
