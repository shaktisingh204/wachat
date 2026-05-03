'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Shield,
  ArrowLeft,
  UserPlus,
  Trash2,
  LoaderCircle,
} from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  getRoleById,
  getRoleMembers,
  assignUserToRole,
  removeUserFromRole,
  getPermissionsGroupedByModule,
  getPermissionTypes,
  getPermissionsForRole,
  grantPermissionToRole,
  revokePermissionFromRole,
  seedPermissionTypes,
} from '@/app/actions/worksuite/rbac.actions';
import type {
  WsRole,
  WsPermission,
  WsPermissionType,
  WsModule,
  WsPermissionRole,
  WsRoleUser,
} from '@/lib/worksuite/rbac-types';

type PermRow = WsPermission & { _id: string };
type ModRow = WsModule & { _id: string };
type Grouped = { module: ModRow | null; permissions: PermRow[] };
type TypeRow = WsPermissionType & { _id: string };
type MemberRow = WsRoleUser & { _id: string };
type GrantRow = WsPermissionRole & { _id: string };

function initials(name: string) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Role detail — edit members and permission matrix. The matrix has
 * permissions as rows and permission-type columns; exactly one type
 * may be active per permission (or none, if revoked).
 */
export default function RoleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roleId = params?.id as string;
  const { toast } = useToast();

  const [role, setRole] = useState<(WsRole & { _id: string }) | null>(null);
  const [groups, setGroups] = useState<Grouped[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [grants, setGrants] = useState<Map<string, string>>(new Map()); // permId -> typeId
  const [isLoading, startLoading] = useTransition();
  const [isBusy, startBusy] = useTransition();

  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');

  const refresh = React.useCallback(() => {
    if (!roleId) return;
    startLoading(async () => {
      const [r, g, t, m, gr] = await Promise.all([
        getRoleById(roleId),
        getPermissionsGroupedByModule(),
        getPermissionTypes(),
        getRoleMembers(roleId),
        getPermissionsForRole(roleId),
      ]);
      setRole(r as any);
      setGroups((g as Grouped[]) || []);
      let typesList = (t as TypeRow[]) || [];
      if (typesList.length === 0) {
        await seedPermissionTypes();
        typesList = ((await getPermissionTypes()) as TypeRow[]) || [];
      }
      setTypes(typesList);
      setMembers((m as MemberRow[]) || []);
      const map = new Map<string, string>();
      for (const row of (gr as GrantRow[]) || []) {
        map.set(String(row.permission_id), String(row.permission_type_id));
      }
      setGrants(map);
    });
  }, [roleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleCell = (permId: string, typeId: string) => {
    const current = grants.get(permId);
    startBusy(async () => {
      if (current === typeId) {
        const res = await revokePermissionFromRole(permId, roleId);
        if (!res.success) {
          toast({
            title: 'Error',
            description: res.error || 'Failed to revoke',
            variant: 'destructive',
          });
          return;
        }
        const m = new Map(grants);
        m.delete(permId);
        setGrants(m);
      } else {
        const res = await grantPermissionToRole(permId, roleId, typeId);
        if (!res.success) {
          toast({
            title: 'Error',
            description: res.error || 'Failed to grant',
            variant: 'destructive',
          });
          return;
        }
        const m = new Map(grants);
        m.set(permId, typeId);
        setGrants(m);
      }
    });
  };

  const addMember = async () => {
    const id = newMemberEmail.trim() || newMemberName.trim();
    if (!id) {
      toast({
        title: 'Enter a user',
        description: 'Provide an email or name to assign.',
        variant: 'destructive',
      });
      return;
    }
    const res = await assignUserToRole(roleId, id, {
      user_name: newMemberName.trim(),
      user_email: newMemberEmail.trim(),
    });
    if (res.success) {
      setNewMemberEmail('');
      setNewMemberName('');
      toast({ title: 'Added', description: 'Member assigned to role.' });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed',
        variant: 'destructive',
      });
    }
  };

  const removeMember = async (userId: string) => {
    const res = await removeUserFromRole(roleId, userId);
    if (res.success) {
      toast({ title: 'Removed', description: 'Member removed.' });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed',
        variant: 'destructive',
      });
    }
  };

  if (isLoading && !role) {
    return (
      <div className="flex h-60 items-center justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="Role not found"
          subtitle="This role may have been deleted."
          icon={Shield}
        />
        <Link href="/dashboard/crm/settings/roles">
          <ClayButton variant="pill">Back to roles</ClayButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={role.display_name || role.name}
        subtitle={role.description || 'Manage members and permissions for this role.'}
        icon={Shield}
        actions={
          <Link href="/dashboard/crm/settings/roles">
            <ClayButton
              variant="pill"
              leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />}
            >
              Back
            </ClayButton>
          </Link>
        }
      />

      {/* Members */}
      <ClayCard>
        <div className="border-b border-border p-5">
          <h2 className="text-[15px] font-semibold text-foreground">Members</h2>
          <p className="text-[13px] text-muted-foreground">
            {members.length} assigned
          </p>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <Label htmlFor="newMemberName" className="text-foreground">
                Name
              </Label>
              <Input
                id="newMemberName"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Alex Doe"
                className="h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="newMemberEmail" className="text-foreground">
                Email / user id
              </Label>
              <Input
                id="newMemberEmail"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="alex@example.com"
                className="h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
            <ClayButton
              variant="obsidian"
              onClick={addMember}
              leading={<UserPlus className="h-4 w-4" strokeWidth={1.75} />}
            >
              Add
            </ClayButton>
          </div>

          {members.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
              No members yet.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {members.map((m) => {
                const label = m.user_name || m.user_email || m.user_id;
                return (
                  <li
                    key={m._id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-accent text-[12px] text-accent-foreground">
                          {initials(label)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-[13px] font-medium text-foreground">
                          {label}
                        </div>
                        {m.user_email && m.user_name ? (
                          <div className="text-[12px] text-muted-foreground">
                            {m.user_email}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember(m.user_id)}
                      aria-label="Remove member"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ClayCard>

      {/* Permission matrix */}
      <ClayCard>
        <div className="border-b border-border p-5">
          <h2 className="text-[15px] font-semibold text-foreground">
            Permission matrix
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Toggle a cell to grant this role the permission with the chosen
            type. Toggle again to revoke.{' '}
            {isBusy ? (
              <LoaderCircle className="ml-2 inline h-3 w-3 animate-spin" />
            ) : null}
          </p>
        </div>

        <div className="overflow-x-auto p-5">
          {groups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
              No permissions defined. Create some under{' '}
              <Link
                href="/dashboard/crm/settings/permissions"
                className="underline"
              >
                Permissions
              </Link>
              .
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">
                    Permission
                  </TableHead>
                  {types.map((t) => (
                    <TableHead
                      key={t._id}
                      className="text-center text-muted-foreground"
                    >
                      {t.display_name || t.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g, gi) => (
                  <React.Fragment key={g.module?._id || `orphan-${gi}`}>
                    <TableRow className="border-border bg-accent/30 hover:bg-accent/30">
                      <TableCell
                        colSpan={types.length + 1}
                        className="text-[13px] font-semibold text-foreground"
                      >
                        {g.module?.display_name ||
                          g.module?.module_name ||
                          'Uncategorised'}
                      </TableCell>
                    </TableRow>
                    {g.permissions.length === 0 ? (
                      <TableRow className="border-border">
                        <TableCell
                          colSpan={types.length + 1}
                          className="py-3 text-center text-[12px] text-muted-foreground"
                        >
                          No permissions in this module.
                        </TableCell>
                      </TableRow>
                    ) : (
                      g.permissions.map((p) => {
                        const activeType = grants.get(String(p._id));
                        return (
                          <TableRow key={p._id} className="border-border">
                            <TableCell className="text-[13px] text-foreground">
                              <div className="font-medium">
                                {p.display_name || p.name}
                              </div>
                              <div className="text-[12px] text-muted-foreground">
                                <code>{p.name}</code>
                              </div>
                            </TableCell>
                            {types.map((t) => {
                              const checked = activeType === String(t._id);
                              return (
                                <TableCell
                                  key={t._id}
                                  className="text-center"
                                >
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 cursor-pointer accent-foreground"
                                    checked={checked}
                                    disabled={isBusy}
                                    onChange={() =>
                                      toggleCell(String(p._id), String(t._id))
                                    }
                                    aria-label={`${p.name} — ${t.name}`}
                                  />
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          {Array.from(grants.entries()).slice(0, 6).map(([permId, typeId]) => {
            const perm = groups
              .flatMap((g) => g.permissions)
              .find((p) => String(p._id) === permId);
            const type = types.find((t) => String(t._id) === typeId);
            if (!perm || !type) return null;
            return (
              <ClayBadge key={permId} tone="green">
                {perm.name} · {type.name}
              </ClayBadge>
            );
          })}
        </div>
      </ClayCard>

      {/* Avoid unused-import noise when router is only used conditionally above. */}
      <span className="hidden">{String(!!router)}</span>
    </div>
  );
}
