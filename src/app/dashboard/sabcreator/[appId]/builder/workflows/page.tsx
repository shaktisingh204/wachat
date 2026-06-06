import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Workflow } from 'lucide-react';

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
    <div className="ui20 px-6 py-8 space-y-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Workflows</PageTitle>
          <PageDescription>
            {app.name}, triggers, schedules and SabFlow delegations.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Link
            href={`/dashboard/sabcreator/${appId}/builder`}
            className="u-btn u-btn--outline u-btn--md"
          >
            <span className="u-btn__label">Back to builder</span>
          </Link>
        </PageActions>
      </PageHeader>

      {workflows.items.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No workflows yet"
          description="Add workflows from the builder shell (Workflows tab)."
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
                    <span className="font-medium">{w.name}</span>
                  </Td>
                  <Td>
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      trigger: {w.trigger.kind}
                      {w.sabflowRefId
                        ? `, sabflow ${w.sabflowRefId.slice(-6)}`
                        : ', inline'}
                    </span>
                  </Td>
                  <Td align="right">
                    <Badge tone="neutral">{w.status}</Badge>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
