import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit role page — server wrapper that loads the role and passes it as
 * `initialData` to `<RoleForm />`. The full permission matrix and member
 * assignment editor live on `roles/[id]` (the detail page); this page
 * intentionally only edits the role's own metadata so admins can rename
 * or re-purpose a role without having to touch its grants.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getRoleById } from '@/app/actions/worksuite/rbac.actions';
import type { WsRole } from '@/lib/worksuite/rbac-types';

import { RoleForm } from '../../_components/role-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/settings/roles';

export default async function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user) redirect('/login');

  const role = (await getRoleById(id)) as
    | (WsRole & { _id: string })
    | null;
  if (!role) notFound();

  return (
    <EntityDetailShell
      eyebrow="ROLE"
      title={`Edit · ${role.display_name || role.name}`}
      back={{ href: `${BASE}/${id}`, label: role.display_name || role.name }}
    >
      <RoleForm initialData={role} />
    </EntityDetailShell>
  );
}
