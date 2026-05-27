import { notFound } from 'next/navigation';

import {
  getSabcreatorApp,
  getSabcreatorPage,
} from '@/app/actions/sabcreator.actions';

import { PageDesignerClient } from './_components/page-designer-client';

export const dynamic = 'force-dynamic';

interface RouteParams {
  appId: string;
  pageId: string;
}

export default async function PageDesignerPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { appId, pageId } = await params;
  const [app, page] = await Promise.all([
    getSabcreatorApp(appId).catch(() => null),
    getSabcreatorPage(pageId).catch(() => null),
  ]);
  if (!app || !page) notFound();
  return <PageDesignerClient app={app} page={page} />;
}
