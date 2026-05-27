import { notFound } from 'next/navigation';

import {
  listSabcreatorApps,
  listSabcreatorForms,
  listSabcreatorPages,
} from '@/app/actions/sabcreator.actions';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  ZoruPageDescription,
  ZoruPageTitle,
} from '@/components/zoruui';

import { PreviewRunnerClient } from '@/app/dashboard/sabcreator/[appId]/preview/_components/preview-runner-client';

export const dynamic = 'force-dynamic';

interface RouteParams {
  appSlug: string;
}

/**
 * Public-ish runtime for SabCreator apps inside the tenant's own org.
 * Looks up by slug, then renders forms + pages via the same runner the
 * builder preview uses. Real public/embed serving will go through the
 * SabCreator publication snapshot — that's a follow-up.
 */
export default async function SabcreatorRuntimePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { appSlug } = await params;
  // Slug isn't indexed-search via /apps yet — list + filter is OK for now.
  const apps = await listSabcreatorApps({ status: 'published', limit: 500 }).catch(
    () => ({ items: [], page: 0, limit: 500, hasMore: false }),
  );
  const app = apps.items.find((a) => a.slug === appSlug);
  if (!app) notFound();

  const [forms, pages] = await Promise.all([
    listSabcreatorForms({ appId: app._id, limit: 200, status: 'published' }).catch(
      () => ({ items: [], page: 0, limit: 200, hasMore: false }),
    ),
    listSabcreatorPages({ appId: app._id, limit: 200, status: 'published' }).catch(
      () => ({ items: [], page: 0, limit: 200, hasMore: false }),
    ),
  ]);

  return (
    <div className="zoruui min-h-screen bg-zoru-surface">
      <div className="px-6 py-8 space-y-6 max-w-5xl mx-auto">
        <PageHeader>
          <div>
            <ZoruPageTitle>{app.name}</ZoruPageTitle>
            <ZoruPageDescription>
              {app.description ?? 'A SabCreator app.'}
            </ZoruPageDescription>
          </div>
          <Badge variant="default">{app.status}</Badge>
        </PageHeader>
        {forms.items.length === 0 && pages.items.length === 0 ? (
          <EmptyState
            title="This app has nothing published yet"
            description="Ask the app owner to publish at least one form or page."
          />
        ) : (
          <Card className="p-4">
            <PreviewRunnerClient forms={forms.items} pages={pages.items} />
          </Card>
        )}
      </div>
    </div>
  );
}
