/**
 * Roles and access route (server component).
 *
 * This file fetches the app, its roles, and its role assignments, then hands
 * everything to the client editor. It renders no UI primitives itself. All of
 * the interface lives in `./_components/roles-editor-client`, which is built
 * entirely on the 20ui design system (`@/components/sabcrm/20ui`).
 */
import { notFound } from 'next/navigation';

import {
  getSabcreatorApp,
  listSabcreatorRoleAssignments,
  listSabcreatorRoles,
} from '@/app/actions/sabcreator.actions';

import { RolesEditorClient } from './_components/roles-editor-client';

export const dynamic = 'force-dynamic';

interface RouteParams {
  appId: string;
}

export default async function RolesEditorPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { appId } = await params;
  const app = await getSabcreatorApp(appId).catch(() => null);
  if (!app) notFound();
  const [roles, assignments] = await Promise.all([
    listSabcreatorRoles({ appId, limit: 200 }).catch(() => ({
      items: [],
      page: 0,
      limit: 200,
      hasMore: false,
    })),
    listSabcreatorRoleAssignments({ appId, limit: 500 }).catch(() => ({
      items: [],
      page: 0,
      limit: 500,
      hasMore: false,
    })),
  ]);
  return (
    <RolesEditorClient
      app={app}
      initialRoles={roles.items}
      initialAssignments={assignments.items}
    />
  );
}
