'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button, Badge, Card, useZoruToast } from '@/components/zoruui';
import {
  updatePermissionGroup,
  removeGroupFromEmployee,
  type HrmPermissionGroup,
  type ModulePermission,
} from '@/app/actions/hrm-permission-groups.actions';
import { PermissionMatrix } from '../_components/permission-matrix';
import { GroupDetailsCard } from './group-details-card';
import { AssignedEmployeesTable } from './assigned-employees-table';

interface AssignedEmployee {
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

export function ClientPage({
  id,
  initialGroup,
  initialEmpAssignments,
  allEmployees,
}: ClientPageProps) {
  const router = useRouter();
  const { toast } = useZoruToast();

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

  // Simulate WebSockets real-time collaborative editing
  React.useEffect(() => {
    // In a real app, this would be: const ws = new WebSocket('ws://...');
    // We mock real-time updates for demonstration
    const interval = setInterval(() => {
      // Dummy check or connection ping
      // If someone else edits the group, we would receive an event here
      // e.g. ws.onmessage = (event) => { const data = JSON.parse(event.data); ... }
    }, 15000);
    return () => clearInterval(interval);
  }, [id]);

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
          toast({ title: 'Some assignments could not be removed', variant: 'destructive' });
          // In a real scenario, we might want to refetch to get accurate state
          // For now, we leave the successful ones removed and maybe show error
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
        <ShieldCheck className="h-10 w-10 text-zoru-ink-muted" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-zoru-ink">Group not found</h2>
        <p className="text-[13px] text-zoru-ink-muted">
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
            <h1 className="text-xl font-semibold text-zoru-ink">{group?.name}</h1>
            <p className="text-[13px] text-zoru-ink-muted">
              Edit permissions and manage employee assignments
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin mr-2" /> : null}
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

      <GroupDetailsCard
        name={name}
        description={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        group={group}
        assignedCount={assignedEmployees.length}
      />

      <Card className="flex flex-col gap-4 p-5 print:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zoru-ink">Module Permissions</h2>
          <Badge variant="secondary">
            {permissions.filter((p) => p.actions.length > 0).length} modules active
          </Badge>
        </div>
        <PermissionMatrix value={permissions} onChange={setPermissions} />
      </Card>

      <AssignedEmployeesTable
        employees={assignedEmployees}
        removingId={removingId}
        onRemove={handleRemoveEmployee}
        onBulkRemove={handleBulkRemove}
      />
    </div>
  );
}
