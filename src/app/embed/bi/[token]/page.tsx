/**
 * Public BI embed render route.
 *
 * Anonymous — looks up an embed by token, then renders the workbook's
 * charts inline. No login required. The token's expiry + allowOrigins
 * are enforced server-side by `resolveBiEmbedByToken`.
 */
import { notFound } from 'next/navigation';

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
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
    <div className="zoruui min-h-screen bg-[var(--st-bg)] p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header>
          <h1 className="text-2xl font-semibold text-[var(--st-text)]">{payload.name}</h1>
          {payload.description && (
            <p className="text-sm text-[var(--st-text-secondary)]">{payload.description}</p>
          )}
        </header>

        {payload.charts.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No charts published</CardTitle>
              <CardDescription>
                The workbook owner hasn&apos;t added any charts yet.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {payload.charts.map((chart, i) => {
              const c = chart as Record<string, unknown>;
              return (
                <Card key={(c.chartId as string) ?? i}>
                  <CardHeader>
                    <CardTitle>{(c.name as string) ?? 'Chart'}</CardTitle>
                    <CardDescription>
                      <Badge variant="outline">{(c.type as string) ?? 'unknown'}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                      Embedded chart payloads are rendered by the workbook
                      owner&apos;s saved config. Interactive previews require
                      a logged-in session.
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
