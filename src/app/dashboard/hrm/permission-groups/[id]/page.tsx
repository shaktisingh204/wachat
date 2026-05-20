'use client';

/**
 * /dashboard/hrm/permission-groups/[id]
 *
 * Edit page for a single permission group.
 *   - Inline-editable name + description
 *   - Full <PermissionMatrix /> with save
 *   - Table of employees currently assigned to this group with a remove button
 */

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, LoaderCircle, ShieldCheck, UserMinus } from 'lucide-react';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  getPermissionGroupById,
  updatePermissionGroup,
  removeGroupFromEmployee,
  getEmployeesInGroup,
  getHrmEmployeeList,
} from '@/app/actions/hrm-permission-groups.actions';
import type {
  HrmPermissionGroup,
  ModulePermission,
} from '@/app/actions/hrm-permission-groups.actions';
import { PermissionMatrix } from '../_components/permission-matrix';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface AssignedEmployee {
  employeeId: string;
  name: string;
  email?: string;
  assignedAt: string;
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function PermissionGroupEditPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useZoruToast();

  const [group, setGroup] = React.useState<HrmPermissionGroup | null>(null);
  const [assignedEmployees, setAssignedEmployees] = React.useState<AssignedEmployee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  // Editable state
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [permissions, setPermissions] = React.useState<ModulePermission[]>([]);
  const [saving, startSaveTransition] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  /* ── Load ────────────────────────────────────────────────────────────── */

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [grp, empAssignments, allEmployees] = await Promise.all([
        getPermissionGroupById(id),
        getEmployeesInGroup(id),
        getHrmEmployeeList(),
      ]);

      if (!grp) {
        setNotFound(true);
        return;
      }

      setGroup(grp);
      setName(grp.name);
      setDescription(grp.description ?? '');
      setPermissions(grp.permissions);

      // Join employee IDs with their names
      const empMap = new Map(allEmployees.map((e) => [e._id, e]));
      setAssignedEmployees(
        empAssignments.map((a) => {
          const emp = empMap.get(a.employeeId);
          return {
            employeeId: a.employeeId,
            name: emp?.name ?? a.employeeId,
            email: emp?.email,
            assignedAt: a.assignedAt,
          };
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  /* ── Save ────────────────────────────────────────────────────────────── */

  const handleSave = React.useCallback(() => {
    if (!name.trim()) {
      toast({ title: 'Group name is required', variant: 'destructive' });
      return;
    }
    startSaveTransition(async () => {
      const res = await updatePermissionGroup(id, {
        name: name.trim(),
        description: description.trim(),
        permissions,
      });
      if (res.success) {
        toast({ title: 'Permission group saved' });
        await load();
      } else {
        toast({ title: res.error ?? 'Save failed', variant: 'destructive' });
      }
    });
  }, [id, name, description, permissions, toast, load]);

  /* ── Remove employee assignment ──────────────────────────────────────── */

  const handleRemoveEmployee = React.useCallback(
    async (employeeId: string) => {
      setRemovingId(employeeId);
      try {
        const res = await removeGroupFromEmployee(employeeId);
        if (res.success) {
          toast({ title: 'Assignment removed' });
          await load();
        } else {
          toast({ title: res.error ?? 'Failed', variant: 'destructive' });
        }
      } finally {
        setRemovingId(null);
      }
    },
    [toast, load],
  );

  /* ── Not found ───────────────────────────────────────────────────────── */

  if (!loading && notFound) {
    return (
      <div className="flex flex-col items-center gap-4 p-12 text-center">
        <ShieldCheck className="h-10 w-10 text-zoru-ink-muted" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-zoru-ink">Group not found</h2>
        <p className="text-[13px] text-zoru-ink-muted">
          This permission group may have been deleted.
        </p>
        <ZoruButton
          variant="outline"
          onClick={() => router.push('/dashboard/hrm/permission-groups')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Groups
        </ZoruButton>
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ZoruButton
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/hrm/permission-groups')}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </ZoruButton>
          <div>
            {loading ? (
              <ZoruSkeleton className="h-6 w-48" />
            ) : (
              <h1 className="text-xl font-semibold text-zoru-ink">
                {group?.name}
              </h1>
            )}
            <p className="text-[13px] text-zoru-ink-muted">
              Edit permissions and manage employee assignments
            </p>
          </div>
        </div>
        <ZoruButton
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : null}
          {saving ? 'Saving…' : 'Save Changes'}
        </ZoruButton>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-24 w-full rounded-[var(--zoru-radius)]" />
          ))}
        </div>
      ) : (
        <>
          {/* Identity card */}
          <ZoruCard className="flex flex-col gap-5 p-5">
            <h2 className="text-sm font-semibold text-zoru-ink">
              Group Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <ZoruLabel htmlFor="edit-name">
                  Name <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruInput
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Team Lead"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="edit-desc">Description</ZoruLabel>
                <ZoruTextarea
                  id="edit-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes…"
                  rows={2}
                />
              </div>
            </div>

            {/* Meta strip */}
            {group ? (
              <div className="flex flex-wrap gap-4 border-t border-zoru-line pt-4 text-[12px] text-zoru-ink-muted">
                <span>
                  Created:{' '}
                  <span className="text-zoru-ink">
                    {new Date(group.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <span>
                  Last updated:{' '}
                  <span className="text-zoru-ink">
                    {new Date(group.updatedAt).toLocaleDateString()}
                  </span>
                </span>
                <span>
                  Employees assigned:{' '}
                  <span className="text-zoru-ink">
                    {assignedEmployees.length}
                  </span>
                </span>
              </div>
            ) : null}
          </ZoruCard>

          {/* Permission matrix card */}
          <ZoruCard className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zoru-ink">
                Module Permissions
              </h2>
              <ZoruBadge variant="secondary">
                {permissions.filter((p) => p.actions.length > 0).length} modules active
              </ZoruBadge>
            </div>
            <PermissionMatrix value={permissions} onChange={setPermissions} />
          </ZoruCard>

          {/* Assigned employees card */}
          <ZoruCard className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zoru-ink">
                Assigned Employees
              </h2>
              <ZoruBadge variant="secondary">
                {assignedEmployees.length}
              </ZoruBadge>
            </div>

            {assignedEmployees.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-zoru-ink-muted">
                No employees are assigned to this group yet. Use{' '}
                <span className="font-medium text-zoru-ink">
                  Manage Assignments
                </span>{' '}
                on the groups list page.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-zoru-line">
                <ZoruTable>
                  <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                      <ZoruTableHead>Employee</ZoruTableHead>
                      <ZoruTableHead>Email</ZoruTableHead>
                      <ZoruTableHead>Assigned</ZoruTableHead>
                      <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {assignedEmployees.map((e) => (
                      <ZoruTableRow key={e.employeeId} className="border-zoru-line">
                        <ZoruTableCell className="font-medium text-zoru-ink">
                          {e.name}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                          {e.email ?? '—'}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                          {new Date(e.assignedAt).toLocaleDateString()}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <ZoruButton
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${e.name}`}
                            disabled={removingId === e.employeeId}
                            onClick={() => void handleRemoveEmployee(e.employeeId)}
                          >
                            {removingId === e.employeeId ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UserMinus className="h-3.5 w-3.5 text-zoru-danger-ink" />
                            )}
                          </ZoruButton>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ))}
                  </ZoruTableBody>
                </ZoruTable>
              </div>
            )}
          </ZoruCard>
        </>
      )}
    </div>
  );
}
