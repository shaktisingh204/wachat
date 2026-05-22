'use client';

/**
 * <AssignGroupSheet /> — slide-over for assigning a permission group to an
 * employee. Opened from the "Manage Assignments" section of the list page.
 */

import * as React from 'react';
import { UserCheck } from 'lucide-react';
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
} from '@/components/zoruui';
import {
  assignGroupToEmployee,
  removeGroupFromEmployee,
} from '@/app/actions/hrm-permission-groups.actions';
import type {
  HrmPermissionGroup,
} from '@/app/actions/hrm-permission-groups.actions';

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
    <ZoruSheet open={open} onOpenChange={handleOpenChange}>
      <ZoruSheetTrigger asChild>
        <ZoruButton variant="outline" size="sm">
          <UserCheck className="h-4 w-4" />
          Manage Assignments
        </ZoruButton>
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
          <div className="space-y-2">
            <ZoruLabel htmlFor="emp-select">Employee</ZoruLabel>
            <ZoruSelect value={employeeId} onValueChange={setEmployeeId}>
              <ZoruSelectTrigger id="emp-select">
                <ZoruSelectValue placeholder="Select employee…" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {employees.map((e) => (
                  <ZoruSelectItem key={e._id} value={e._id}>
                    {e.name}
                    {e.email ? (
                      <span className="ml-1 text-zoru-ink-muted text-xs">
                        ({e.email})
                      </span>
                    ) : null}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          {/* Group picker */}
          <div className="space-y-2">
            <ZoruLabel htmlFor="grp-select">Permission Group</ZoruLabel>
            <ZoruSelect value={groupId} onValueChange={setGroupId}>
              <ZoruSelectTrigger id="grp-select">
                <ZoruSelectValue placeholder="None (remove assignment)" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {groups.map((g) => (
                  <ZoruSelectItem key={g._id} value={g._id}>
                    {g.name}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <p className="text-[11px] text-zoru-ink-muted">
              Leave blank to remove the employee&apos;s current group.
            </p>
          </div>

          {/* Summary of current assignment */}
          {employeeId ? (
            <div className="rounded-md border border-zoru-line bg-zoru-surface-2 p-3 text-[13px]">
              {(() => {
                const emp = employees.find((e) => e._id === employeeId);
                const current = currentAssignments.find(
                  (a) => a.employeeId === employeeId,
                );
                const grp = groups.find((g) => g._id === current?.groupId);
                return (
                  <>
                    <p className="font-medium text-zoru-ink">
                      {emp?.name ?? employeeId}
                    </p>
                    <p className="mt-0.5 text-zoru-ink-muted">
                      Current group:{' '}
                      <span className="font-medium text-zoru-ink">
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
          <ZoruButton
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </ZoruButton>
          <ZoruButton onClick={handleSave} disabled={saving || !employeeId}>
            {saving ? 'Saving…' : 'Save'}
          </ZoruButton>
        </ZoruSheetFooter>
      </ZoruSheetContent>
    </ZoruSheet>
  );
}
