import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  getSabcreatorApp,
  listSabcreatorForms,
  listSabcreatorPages,
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
} from '@/components/zoruui';

import { PreviewRunnerClient } from './_components/preview-runner-client';

export const dynamic = 'force-dynamic';

interface RouteParams {
  appId: string;
}

export default async function SabcreatorPreviewPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { appId } = await params;
  const app = await getSabcreatorApp(appId).catch(() => null);
  if (!app) notFound();
  const [forms, pages] = await Promise.all([
    listSabcreatorForms({ appId, limit: 200 }).catch(() => ({
      items: [],
      page: 0,
      limit: 200,
      hasMore: false,
    })),
    listSabcreatorPages({ appId, limit: 200 }).catch(() => ({
      items: [],
      page: 0,
      limit: 200,
      hasMore: false,
    })),
  ]);

  return (
    <div className="px-6 py-8 space-y-6">
      <PageHeader>
        <div>
          <ZoruPageTitle>Preview · {app.name}</ZoruPageTitle>
          <ZoruPageDescription>
            How an end-user would see the app today.
          </ZoruPageDescription>
        </div>
        <ZoruPageActions>
          <Badge variant={app.status === 'published' ? 'default' : 'outline'}>
            {app.status}
          </Badge>
          <Button asChild variant="outline">
            <Link href={`/dashboard/sabcreator/${app._id}/builder`}>
              Back to builder
            </Link>
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {forms.items.length === 0 && pages.items.length === 0 ? (
        <EmptyState
          title="Nothing to preview yet"
          description="Add at least one form or page from the builder."
        />
      ) : (
        <Card className="p-4">
          <PreviewRunnerClient forms={forms.items} pages={pages.items} />
        </Card>
      )}
    </div>
  );
}
