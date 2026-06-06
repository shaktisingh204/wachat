'use client';

import * as React from 'react';
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';

interface Employee {
  _id: string;
  name: string;
  email?: string;
}

interface Group {
  _id: string;
  name: string;
}

interface AssignmentFormProps {
  employees: Employee[];
  groups: Group[];
  employeeId: string;
  groupId: string;
  onEmployeeChange: (val: string) => void;
  onGroupChange: (val: string) => void;
}

export function AssignmentForm({
  employees,
  groups,
  employeeId,
  groupId,
  onEmployeeChange,
  onGroupChange,
}: AssignmentFormProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="emp-select">Employee</Label>
        <Select value={employeeId} onValueChange={onEmployeeChange}>
          <SelectTrigger id="emp-select">
            <SelectValue placeholder="Select employee…" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((e) => (
              <SelectItem key={e._id} value={e._id}>
                {e.name}
                {e.email ? (
                  <span className="ml-1 text-[var(--st-text-secondary)] text-xs">
                    ({e.email})
                  </span>
                ) : null}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="grp-select">Permission Group</Label>
        <Select value={groupId} onValueChange={onGroupChange}>
          <SelectTrigger id="grp-select">
            <SelectValue placeholder="None (remove assignment)" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g._id} value={g._id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-[var(--st-text-secondary)]">
          Leave blank to remove the employee&apos;s current group.
        </p>
      </div>
    </>
  );
}
