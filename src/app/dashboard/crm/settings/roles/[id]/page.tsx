'use client';

import {
  Avatar,
  ZoruAvatarFallback,
  Badge,
  Button,
  Card,
  Input,
  Label,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useParams,
  useRouter } from 'next/navigation';
import {
  UserPlus,
  Trash2,
  LoaderCircle,
  } from 'lucide-react';
import { useEffect,
  useState,
  useTransition } from 'react';

import * as React from 'react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
  const { toast } = useZoruToast();

  const [role, setRole] = useState<(WsRole & { _id: string }) | null>(null);
  const [groups, setGroups] = useState<Grouped[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [grants, setGrants] = useState<Map<string, string>>(new Map()); // permId -> typeId
  const [isLoading, startLoading] = useTransition();
  const [isBusy, startBusy] = useTransition();

  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted || (isLoading && !role)) {
    return (
      <div className="flex h-60 items-center justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-[var(--st-text-secondary)]" />
      </div>
    );
  }

  if (!role) {
    return (
      <EntityDetailShell
        eyebrow="ROLE"
        title="Role not found"
        back={{ href: '/dashboard/crm/settings/roles', label: 'Roles' }}
      >
        <Button variant="outline" asChild>
          <Link href="/dashboard/crm/settings/roles">Back to roles</Link>
        </Button>
      </EntityDetailShell>
    );
  }

  return (
    <EntityDetailShell
      eyebrow="ROLE"
      title={role.display_name || role.name}
      back={{ href: '/dashboard/crm/settings/roles', label: 'Roles' }}
    >

      {/* Members */}
      <Card className="p-0">
        <div className="border-b border-[var(--st-border)] p-5">
          <h2 className="text-[15px] text-[var(--st-text)]">Members</h2>
          <p className="text-[13px] text-[var(--st-text-secondary)]">
            {members.length} assigned
          </p>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <Label htmlFor="newMemberName">Name</Label>
              <Input
                id="newMemberName"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Alex Doe"
              />
            </div>
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="newMemberEmail">Email / user id</Label>
              <Input
                id="newMemberEmail"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="alex@example.com"
              />
            </div>
            <Button onClick={addMember}>
              <UserPlus className="h-4 w-4" />
              Add
            </Button>
          </div>

          {members.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--st-border)] p-6 text-center text-[13px] text-[var(--st-text-secondary)]">
              No members yet.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--st-border)] rounded-lg border border-[var(--st-border)]">
              {members.map((m) => {
                const label = m.user_name || m.user_email || m.user_id;
                return (
                  <li
                    key={m._id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <ZoruAvatarFallback className="bg-[var(--st-bg-muted)] text-[12px] text-[var(--st-text)]">
                          {initials(label)}
                        </ZoruAvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-[13px] text-[var(--st-text)]">{label}</div>
                        {m.user_email && m.user_name ? (
                          <div className="text-[12px] text-[var(--st-text-secondary)]">
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
                      <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* Permission matrix */}
      <Card className="p-0">
        <div className="border-b border-[var(--st-border)] p-5">
          <h2 className="text-[15px] text-[var(--st-text)]">Permission matrix</h2>
          <p className="text-[13px] text-[var(--st-text-secondary)]">
            Toggle a cell to grant this role the permission with the chosen
            type. Toggle again to revoke.{' '}
            {isBusy ? (
              <LoaderCircle className="ml-2 inline h-3 w-3 animate-spin" />
            ) : null}
          </p>
        </div>

        <div className="overflow-x-auto p-5">
          {groups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--st-border)] p-6 text-center text-[13px] text-[var(--st-text-secondary)]">
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
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">Permission</ZoruTableHead>
                  {types.map((t) => (
                    <ZoruTableHead key={t._id} className="text-center text-[var(--st-text-secondary)]">
                      {t.display_name || t.name}
                    </ZoruTableHead>
                  ))}
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {groups.map((g, gi) => (
                  <React.Fragment key={g.module?._id || `orphan-${gi}`}>
                    <ZoruTableRow className="bg-[var(--st-bg-muted)] hover:bg-[var(--st-bg-muted)]">
                      <ZoruTableCell
                        colSpan={types.length + 1}
                        className="text-[13px] text-[var(--st-text)]"
                      >
                        {g.module?.display_name ||
                          g.module?.module_name ||
                          'Uncategorised'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                    {g.permissions.length === 0 ? (
                      <ZoruTableRow>
                        <ZoruTableCell
                          colSpan={types.length + 1}
                          className="py-3 text-center text-[12px] text-[var(--st-text-secondary)]"
                        >
                          No permissions in this module.
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ) : (
                      g.permissions.map((p) => {
                        const activeType = grants.get(String(p._id));
                        return (
                          <ZoruTableRow key={p._id}>
                            <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                              <div>{p.display_name || p.name}</div>
                              <div className="text-[12px] text-[var(--st-text-secondary)]">
                                <code>{p.name}</code>
                              </div>
                            </ZoruTableCell>
                            {types.map((t) => {
                              const checked = activeType === String(t._id);
                              return (
                                <ZoruTableCell key={t._id} className="text-center">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 cursor-pointer accent-[var(--st-text)]"
                                    checked={checked}
                                    disabled={isBusy}
                                    onChange={() =>
                                      toggleCell(String(p._id), String(t._id))
                                    }
                                    aria-label={`${p.name} — ${t.name}`}
                                  />
                                </ZoruTableCell>
                              );
                            })}
                          </ZoruTableRow>
                        );
                      })
                    )}
                  </React.Fragment>
                ))}
              </ZoruTableBody>
            </Table>
          )}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--st-border)] p-4">
          {Array.from(grants.entries()).slice(0, 6).map(([permId, typeId]) => {
            const perm = groups
              .flatMap((g) => g.permissions)
              .find((p) => String(p._id) === permId);
            const type = types.find((t) => String(t._id) === typeId);
            if (!perm || !type) return null;
            return (
              <Badge key={permId} variant="success">
                {perm.name} · {type.name}
              </Badge>
            );
          })}
        </div>
      </Card>

      {/* Avoid unused-import noise when router is only used conditionally above. */}
      <span className="hidden">{String(!!router)}</span>
    </EntityDetailShell>
  );
}
