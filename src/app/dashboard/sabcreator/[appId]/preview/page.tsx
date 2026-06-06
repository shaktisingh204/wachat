import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, LayoutTemplate } from 'lucide-react';

import {
  getSabcreatorApp,
  listSabcreatorForms,
  listSabcreatorPages,
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
  cn,
} from '@/components/sabcrm/20ui';

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

  const isPublished = app.status === 'published';
  const builderHref = `/dashboard/sabcreator/${app._id}/builder`;

  return (
    <div className="px-6 py-8 space-y-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Preview · {app.name}</PageTitle>
          <PageDescription>
            How an end-user would see the app today.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Badge
            tone={isPublished ? 'success' : 'neutral'}
            kind={isPublished ? 'soft' : 'outline'}
            dot
          >
            {app.status}
          </Badge>
          <Link
            href={builderHref}
            className={cn('u-btn', 'u-btn--outline', 'u-btn--md')}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="u-btn__label">Back to builder</span>
          </Link>
        </PageActions>
      </PageHeader>

      {forms.items.length === 0 && pages.items.length === 0 ? (
        <EmptyState
          icon={LayoutTemplate}
          title="Nothing to preview yet"
          description="Add at least one form or page from the builder."
          action={
            <Link
              href={builderHref}
              className={cn('u-btn', 'u-btn--primary', 'u-btn--md')}
            >
              <span className="u-btn__label">Open builder</span>
            </Link>
          }
        />
      ) : (
        <Card padding="md">
          <PreviewRunnerClient forms={forms.items} pages={pages.items} />
        </Card>
      )}
    </div>
  );
}
