'use client';

/**
 * <AssignGroupSheet /> — slide-over for assigning a permission group to an
 * employee. Opened from the "Manage Assignments" section of the list page.
 */

import * as React from 'react';
import { UserCheck } from 'lucide-react';
import { AssignmentForm } from './assignment-form';
import {
  Button,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetTrigger,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  assignGroupToEmployee,
  removeGroupFromEmployee,
} from '@/app/actions/hrm-permission-groups.actions';
import type { HrmPermissionGroup } from '@/app/actions/hrm-permission-groups.actions.types';
/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Employee {
  _id: string;
  name: string;
  email?: string;
}

interface CurrentAssignment {
  employeeId: string;
  groupId: string;
}

interface AssignGroupSheetProps {
  groups: HrmPermissionGroup[];
  employees: Employee[];
  currentAssignments: CurrentAssignment[];
  onChanged: () => void;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function AssignGroupSheet({
  groups,
  employees,
  currentAssignments,
  onChanged,
}: AssignGroupSheetProps): React.JSX.Element {
  const { toast } = useZoruToast();
  const [open, setOpen] = React.useState(false);
  const [employeeId, setEmployeeId] = React.useState('');
  const [groupId, setGroupId] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // When an employee is selected, pre-fill current group
  React.useEffect(() => {
    if (!employeeId) {
      setGroupId('');
      return;
    }
    const current = currentAssignments.find((a) => a.employeeId === employeeId);
    setGroupId(current?.groupId ?? '');
  }, [employeeId, currentAssignments]);

  const handleSave = React.useCallback(async () => {
    if (!employeeId) {
      toast({ title: 'Select an employee', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let res: { success: boolean; error?: string };
      if (groupId) {
        res = await assignGroupToEmployee(employeeId, groupId);
      } else {
        res = await removeGroupFromEmployee(employeeId);
      }
      if (res.success) {
        toast({ title: groupId ? 'Group assigned' : 'Assignment removed' });
        setOpen(false);
        setEmployeeId('');
        setGroupId('');
        onChanged();
      } else {
        toast({ title: res.error ?? 'Failed', variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  }, [employeeId, groupId, toast, onChanged]);

  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setEmployeeId('');
      setGroupId('');
    }
  }, []);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <ZoruSheetTrigger asChild>
        <Button variant="outline" size="sm">
          <UserCheck className="h-4 w-4" />
          Manage Assignments
        </Button>
      </ZoruSheetTrigger>

      <ZoruSheetContent side="right" className="flex w-[420px] flex-col sm:max-w-[420px]">
        <ZoruSheetHeader>
          <ZoruSheetTitle>Manage Assignments</ZoruSheetTitle>
          <ZoruSheetDescription>
            Assign a permission group to an employee, or remove their current
            assignment by leaving the group field blank.
          </ZoruSheetDescription>
        </ZoruSheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto py-4">
          {/* Employee picker */}
          <AssignmentForm
            employees={employees}
            groups={groups}
            employeeId={employeeId}
            groupId={groupId}
            onEmployeeChange={setEmployeeId}
            onGroupChange={setGroupId}
          />

          {/* Summary of current assignment */}
          {employeeId ? (
            <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-[13px]">
              {(() => {
                const emp = employees.find((e) => e._id === employeeId);
                const current = currentAssignments.find(
                  (a) => a.employeeId === employeeId,
                );
                const grp = groups.find((g) => g._id === current?.groupId);
                return (
                  <>
                    <p className="font-medium text-[var(--st-text)]">
                      {emp?.name ?? employeeId}
                    </p>
                    <p className="mt-0.5 text-[var(--st-text-secondary)]">
                      Current group:{' '}
                      <span className="font-medium text-[var(--st-text)]">
                        {grp?.name ?? 'None'}
                      </span>
                    </p>
                  </>
                );
              })()}
            </div>
          ) : null}
        </div>

        <ZoruSheetFooter className="gap-2 pt-4">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !employeeId}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </ZoruSheetFooter>
      </ZoruSheetContent>
    </Sheet>
  );
}
