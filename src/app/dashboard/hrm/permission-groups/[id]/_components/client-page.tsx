'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button, Badge, Card, useToast } from '@/components/sabcrm/20ui/compat';
import {
  updatePermissionGroup,
  removeGroupFromEmployee,
  type HrmPermissionGroup,
  type ModulePermission,
} from '@/app/actions/hrm-permission-groups.actions';
import { GroupDetailsCard } from './group-details-card';
import { AssignedEmployeesTable } from './assigned-employees-table';
import { EditGroupForm } from './edit-group-form';

export interface AssignedEmployee {
  employeeId: string;
  name: string;
  email?: string;
  assignedAt: string;
}

interface ClientPageProps {
  id: string;
  initialGroup: HrmPermissionGroup | null;
  initialEmpAssignments: { employeeId: string; assignedAt: string }[];
  allEmployees: { _id: string; name: string; email?: string }[];
}

import { useGroupWebsocket } from './use-group-websocket';

export function ClientPage({
  id,
  initialGroup,
  initialEmpAssignments,
  allEmployees,
}: ClientPageProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [group, setGroup] = React.useState<HrmPermissionGroup | null>(initialGroup);
  const [assignedEmployees, setAssignedEmployees] = React.useState<AssignedEmployee[]>([]);

  // Editable state
  const [name, setName] = React.useState(initialGroup?.name ?? '');
  const [description, setDescription] = React.useState(initialGroup?.description ?? '');
  const [permissions, setPermissions] = React.useState<ModulePermission[]>(
    initialGroup?.permissions ?? []
  );

  const [saving, startSaveTransition] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  // Real-time collaborative editing hook
  const { notifyUpdate } = useGroupWebsocket(id, React.useCallback((updatedFields) => {
    setGroup((prev) => prev ? { ...prev, ...updatedFields } : null);
    if (updatedFields.name !== undefined) setName(updatedFields.name);
    if (updatedFields.description !== undefined) setDescription(updatedFields.description);
    if (updatedFields.permissions !== undefined) setPermissions(updatedFields.permissions);
  }, []));

  // Initialize assigned employees
  React.useEffect(() => {
    const empMap = new Map(allEmployees.map((e) => [e._id, e]));
    setAssignedEmployees(
      initialEmpAssignments.map((a) => {
        const emp = empMap.get(a.employeeId);
        return {
          employeeId: a.employeeId,
          name: emp?.name ?? a.employeeId,
          email: emp?.email,
          assignedAt: a.assignedAt,
        };
      })
    );
  }, [initialEmpAssignments, allEmployees]);

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
        toast({ title: 'Permission group saved successfully' });
        // Optimistically update group local state
        setGroup((prev) =>
          prev
            ? { ...prev, name: name.trim(), description: description.trim(), permissions, updatedAt: new Date().toISOString() }
            : null
        );
        notifyUpdate({ name: name.trim(), description: description.trim(), permissions });
      } else {
        toast({ title: res.error ?? 'Save failed', variant: 'destructive' });
      }
    });
  }, [id, name, description, permissions, toast]);

  /* ── Remove employee assignment ──────────────────────────────────────── */

  const handleRemoveEmployee = React.useCallback(
    async (employeeId: string) => {
      // Optimistic UI update
      const previousEmployees = [...assignedEmployees];
      setAssignedEmployees((prev) => prev.filter((e) => e.employeeId !== employeeId));
      setRemovingId(employeeId);

      try {
        const res = await removeGroupFromEmployee(employeeId);
        if (res.success) {
          toast({ title: 'Assignment removed' });
        } else {
          // Revert optimistic update
          setAssignedEmployees(previousEmployees);
          toast({ title: res.error ?? 'Failed to remove assignment', variant: 'destructive' });
        }
      } catch (err) {
        setAssignedEmployees(previousEmployees);
        toast({ title: 'An unexpected error occurred', variant: 'destructive' });
      } finally {
        setRemovingId(null);
      }
    },
    [assignedEmployees, toast]
  );

  const handleBulkRemove = React.useCallback(
    async (employeeIds: string[]) => {
      // Optimistic UI update
      const previousEmployees = [...assignedEmployees];
      setAssignedEmployees((prev) => prev.filter((e) => !employeeIds.includes(e.employeeId)));

      try {
        // Run removals in parallel for bulk
        const results = await Promise.all(
          employeeIds.map((eid) => removeGroupFromEmployee(eid))
        );
        const hasErrors = results.some((r) => !r.success);
        
        if (hasErrors) {
          toast({ 
            title: 'Partial Removal Failure', 
            description: 'Some employee assignments could not be removed. Please refresh the page and try again.',
            variant: 'destructive' 
          });
        } else {
          toast({ title: 'Bulk removal successful' });
        }
      } catch (err) {
        setAssignedEmployees(previousEmployees);
        toast({ title: 'An unexpected error occurred during bulk remove', variant: 'destructive' });
      }
    },
    [assignedEmployees, toast]
  );

  /* ── Not found ───────────────────────────────────────────────────────── */

  if (!initialGroup) {
    return (
      <div className="flex flex-col items-center gap-4 p-12 text-center">
        <ShieldCheck className="h-10 w-10 text-[var(--st-text-secondary)]" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-[var(--st-text)]">Group not found</h2>
        <p className="text-[13px] text-[var(--st-text-secondary)]">
          This permission group may have been deleted.
        </p>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/hrm/permission-groups')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Groups
        </Button>
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 print:p-0">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/hrm/permission-groups')}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-[var(--st-text)]">{group?.name}</h1>
            <p className="text-[13px] text-[var(--st-text-secondary)]">
              Edit permissions and manage employee assignments
            </p>
          </div>
        </div>
      </div>

      <EditGroupForm
        name={name}
        description={description}
        permissions={permissions}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onPermissionsChange={setPermissions}
        onSave={handleSave}
        saving={saving}
        group={group}
        assignedCount={assignedEmployees.length}
      />

      <AssignedEmployeesTable
        employees={assignedEmployees}
        removingId={removingId}
        onRemove={handleRemoveEmployee}
        onBulkRemove={handleBulkRemove}
      />
    </div>
  );
}
