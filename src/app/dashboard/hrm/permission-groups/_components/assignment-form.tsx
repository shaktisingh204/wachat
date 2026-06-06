'use client';

import * as React from 'react';
import {
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';

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
          <ZoruSelectTrigger id="emp-select">
            <ZoruSelectValue placeholder="Select employee…" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {employees.map((e) => (
              <ZoruSelectItem key={e._id} value={e._id}>
                {e.name}
                {e.email ? (
                  <span className="ml-1 text-[var(--st-text-secondary)] text-xs">
                    ({e.email})
                  </span>
                ) : null}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="grp-select">Permission Group</Label>
        <Select value={groupId} onValueChange={onGroupChange}>
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
        </Select>
        <p className="text-[11px] text-[var(--st-text-secondary)]">
          Leave blank to remove the employee&apos;s current group.
        </p>
      </div>
    </>
  );
}
