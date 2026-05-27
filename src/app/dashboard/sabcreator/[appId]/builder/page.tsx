import { notFound } from 'next/navigation';

import {
  getSabcreatorApp,
  listSabcreatorForms,
  listSabcreatorPages,
  listSabcreatorWorkflows,
  listSabcreatorRoles,
} from '@/app/actions/sabcreator.actions';

import { BuilderShellClient } from './_components/builder-shell-client';

export const dynamic = 'force-dynamic';

interface RouteParams {
  appId: string;
}

export default async function SabcreatorBuilderPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { appId } = await params;
  const app = await getSabcreatorApp(appId).catch(() => null);
  if (!app) notFound();

  const [forms, pages, workflows, roles] = await Promise.all([
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
    listSabcreatorWorkflows({ appId, limit: 200 }).catch(() => ({
      items: [],
      page: 0,
      limit: 200,
      hasMore: false,
    })),
    listSabcreatorRoles({ appId, limit: 200 }).catch(() => ({
      items: [],
      page: 0,
      limit: 200,
      hasMore: false,
    })),
  ]);

  return (
    <BuilderShellClient
      app={app}
      initialForms={forms.items}
      initialPages={pages.items}
      initialWorkflows={workflows.items}
      initialRoles={roles.items}
    />
  );
}
