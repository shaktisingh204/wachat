import { ZoruButton } from '@/components/zoruui';
import {
  notFound,
  redirect } from 'next/navigation';
import { ArrowLeft,
  Shield } from 'lucide-react';

/**
 * Edit role page — server wrapper that loads the role and passes it as
 * `initialData` to `<RoleForm />`. The full permission matrix and member
 * assignment editor live on `roles/[id]` (the detail page); this page
 * intentionally only edits the role's own metadata so admins can rename
 * or re-purpose a role without having to touch its grants.
 */

import Link from 'next/link';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Settings', href: '/dashboard/crm/settings' },
          { label: 'Roles', href: BASE },
          {
            label: role.display_name || role.name,
            href: `${BASE}/${id}`,
          },
          { label: 'Edit' },
        ]}
        title={`Edit · ${role.display_name || role.name}`}
        subtitle="Update role name, slug, description and admin flag. Members and permissions are edited on the detail page."
        icon={Shield}
        actions={
          <ZoruButton variant="ghost" asChild>
            <Link href={`${BASE}/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to detail
            </Link>
          </ZoruButton>
        }
      />

      <RoleForm initialData={role} />
    </div>
  );
}
