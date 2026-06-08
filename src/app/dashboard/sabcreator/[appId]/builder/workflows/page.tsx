import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Workflow } from 'lucide-react';

import {
  getSabcreatorApp,
  listSabcreatorWorkflows,
} from '@/app/actions/sabcreator.actions';
import {
  Badge,
  Card,
  EmptyState,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

interface RouteParams {
  appId: string;
}

export default async function WorkflowsListPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { appId } = await params;
  const app = await getSabcreatorApp(appId).catch(() => null);
  if (!app) notFound();
  const workflows = await listSabcreatorWorkflows({ appId, limit: 200 }).catch(
    () => ({ items: [], page: 0, limit: 200, hasMore: false }),
  );

  return (
    <main className="20ui mx-auto max-w-[1100px] px-6 py-8 space-y-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>
            <Link
              href={`/dashboard/sabcreator/${appId}/builder`}
              className="inline-flex items-center gap-1.5 text-[var(--st-text-secondary)] hover:text-[var(--st-text)] transition-colors"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              {app.name}
            </Link>
          </PageEyebrow>
          <PageTitle>Workflows</PageTitle>
          <PageDescription>
            Triggers, schedules, and SabFlow delegations for this app.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link
            href={`/dashboard/sabcreator/${appId}/builder`}
            className="u-btn u-btn--outline u-btn--md"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="u-btn__label">Back to builder</span>
          </Link>
        </PageActions>
      </PageHeader>

      {workflows.items.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No workflows yet"
          description="Add workflows from the builder shell, then manage them here."
        />
      ) : (
        <Card padding="none">
          <Table>
            <THead>
              <Tr>
                <Th>Workflow</Th>
                <Th>Source</Th>
                <Th align="right">Status</Th>
              </Tr>
            </THead>
            <TBody>
              {workflows.items.map((w) => (
                <Tr key={w._id}>
                  <Td>
                    <span className="font-medium text-[var(--st-text)]">{w.name}</span>
                  </Td>
                  <Td>
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      Trigger: {w.trigger.kind}
                      {w.sabflowRefId
                        ? ` · sabflow ${w.sabflowRefId.slice(-6)}`
                        : ' · inline'}
                    </span>
                  </Td>
                  <Td align="right">
                    <Badge tone="neutral" kind="outline">
                      {w.status}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </main>
  );
}
