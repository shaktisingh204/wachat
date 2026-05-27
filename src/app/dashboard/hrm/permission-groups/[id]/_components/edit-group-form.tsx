'use client';

import * as React from 'react';
import { Button, Badge, Card } from '@/components/zoruui';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { GroupDetailsCard } from './group-details-card';
import { PermissionMatrix } from '../../_components/permission-matrix';
import type { HrmPermissionGroup, ModulePermission } from '@/app/actions/hrm-permission-groups.actions.types';
interface EditGroupFormProps {
  name: string;
  description: string;
  permissions: ModulePermission[];
  onNameChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onPermissionsChange: (val: ModulePermission[]) => void;
  onSave: () => void;
  saving: boolean;
  group: HrmPermissionGroup | null;
  assignedCount: number;
}

export function EditGroupForm({
  name,
  description,
  permissions,
  onNameChange,
  onDescriptionChange,
  onPermissionsChange,
  onSave,
  saving,
  group,
  assignedCount,
}: EditGroupFormProps) {
  if (!group) {
    return (
      <div className="flex flex-col items-center gap-4 p-12 text-center">
        <ShieldCheck className="h-10 w-10 text-zoru-ink-muted" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-zoru-ink">Group not found</h2>
        <p className="text-[13px] text-zoru-ink-muted">
          This permission group may have been deleted.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <GroupDetailsCard
        name={name}
        description={description}
        onNameChange={onNameChange}
        onDescriptionChange={onDescriptionChange}
        group={group}
        assignedCount={assignedCount}
      />

      <Card className="flex flex-col gap-4 p-5 print:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zoru-ink">Module Permissions</h2>
          <Badge variant="secondary">
            {permissions.filter((p) => p.actions.length > 0).length} modules active
          </Badge>
        </div>
        <PermissionMatrix value={permissions} onChange={onPermissionsChange} />
      </Card>
      
      <div className="flex justify-end print:hidden">
        <Button onClick={onSave} disabled={saving}>
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin mr-2" /> : null}
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
