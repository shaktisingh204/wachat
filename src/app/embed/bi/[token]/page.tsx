/**
 * Public BI embed render route.
 *
 * Anonymous: looks up an embed by token, then renders the workbook's
 * charts inline. No login required. The token's expiry + allowOrigins
 * are enforced server-side by `resolveBiEmbedByToken`.
 */
import { notFound } from 'next/navigation';
import { BarChart3 } from 'lucide-react';

import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from '@/components/sabcrm/20ui';
import { resolveEmbedAction } from '@/app/actions/analytics-bi.actions';

export const dynamic = 'force-dynamic';

export default async function PublicEmbedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let payload: Awaited<ReturnType<typeof resolveEmbedAction>>;
  try {
    payload = await resolveEmbedAction(token);
  } catch {
    notFound();
  }

  return (
    <div className="ui20 min-h-screen bg-[var(--st-bg)] p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>{payload.name}</PageTitle>
            {payload.description && (
              <PageDescription>{payload.description}</PageDescription>
            )}
          </PageHeaderHeading>
        </PageHeader>

        {payload.charts.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={BarChart3}
                title="No charts published"
                description="The workbook owner hasn't added any charts yet."
              />
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {payload.charts.map((chart, i) => {
              const c = chart as Record<string, unknown>;
              return (
                <Card key={(c.chartId as string) ?? i}>
                  <CardHeader>
                    <CardTitle>{(c.name as string) ?? 'Chart'}</CardTitle>
                    <Badge variant="outline">{(c.type as string) ?? 'unknown'}</Badge>
                  </CardHeader>
                  <CardBody>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                      Embedded chart payloads are rendered by the workbook
                      owner&apos;s saved config. Interactive previews require
                      a logged-in session.
                    </p>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
