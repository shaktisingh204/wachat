import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  getSabcreatorApp,
  listSabcreatorWorkflows,
} from '@/app/actions/sabcreator.actions';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageTitle,
} from '@/components/sabcrm/20ui/compat';

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
    <div className="px-6 py-8 space-y-6">
      <PageHeader>
        <div>
          <ZoruPageTitle>Workflows</ZoruPageTitle>
          <ZoruPageDescription>
            {app.name} — triggers, schedules and SabFlow delegations.
          </ZoruPageDescription>
        </div>
        <ZoruPageActions>
          <Button asChild variant="outline">
            <Link href={`/dashboard/sabcreator/${appId}/builder`}>
              Back to builder
            </Link>
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {workflows.items.length === 0 ? (
        <EmptyState
          title="No workflows yet"
          description="Add workflows from the builder shell (Workflows tab)."
        />
      ) : (
        <Card className="p-0 divide-y">
          {workflows.items.map((w) => (
            <div
              key={w._id}
              className="px-4 py-3 flex items-center justify-between"
            >
              <div>
                <div className="font-medium">{w.name}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">
                  trigger: {w.trigger.kind}
                  {w.sabflowRefId
                    ? ` · sabflow ${w.sabflowRefId.slice(-6)}`
                    : ' · inline'}
                </div>
              </div>
              <Badge variant="outline">{w.status}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
