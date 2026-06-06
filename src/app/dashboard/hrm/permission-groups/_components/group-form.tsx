'use client';

import * as React from 'react';
import { Input, Label, Textarea } from '@/components/sabcrm/20ui';
import { PermissionMatrix } from './permission-matrix';
import type { ModulePermission } from '@/app/actions/hrm-permission-groups.actions.types';
interface GroupFormProps {
  name: string;
  description: string;
  permissions: ModulePermission[];
  onNameChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onPermissionsChange: (val: ModulePermission[]) => void;
}

export function GroupForm({
  name,
  description,
  permissions,
  onNameChange,
  onDescriptionChange,
  onPermissionsChange,
}: GroupFormProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="grp-name">
          Group name <span className="text-[var(--st-danger)]">*</span>
        </Label>
        <Input
          id="grp-name"
          placeholder="e.g. Team Lead, Developer, Manager"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="grp-desc">Description</Label>
        <Textarea
          id="grp-desc"
          placeholder="Optional notes about this permission group…"
          rows={2}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Module Permissions</Label>
        <PermissionMatrix value={permissions} onChange={onPermissionsChange} />
      </div>
    </>
  );
}
