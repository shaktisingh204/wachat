'use client';

import * as React from 'react';
import { Card, Label, Input, Textarea } from '@/components/zoruui';
import type { HrmPermissionGroup } from '@/app/actions/hrm-permission-groups.actions';

interface GroupDetailsCardProps {
  name: string;
  description: string;
  onNameChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  group: HrmPermissionGroup | null;
  assignedCount: number;
}

export function GroupDetailsCard({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  group,
  assignedCount,
}: GroupDetailsCardProps) {
  // Fix potential hydration mismatch with dates
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const formatDate = (dateStr: string | Date) => {
    if (!mounted) return '';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Card className="flex flex-col gap-5 p-5">
      <h2 className="text-sm font-semibold text-zoru-ink">Group Details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-name">
            Name <span className="text-zoru-danger-ink">*</span>
          </Label>
          <Input
            id="edit-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Team Lead"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-desc">Description</Label>
          <Textarea
            id="edit-desc"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Optional notes…"
            rows={2}
          />
        </div>
      </div>

      {group ? (
        <div className="flex flex-wrap gap-4 border-t border-zoru-line pt-4 text-[12px] text-zoru-ink-muted">
          <span>
            Created:{' '}
            <span className="text-zoru-ink">
              {formatDate(group.createdAt)}
            </span>
          </span>
          <span>
            Last updated:{' '}
            <span className="text-zoru-ink">
              {formatDate(group.updatedAt)}
            </span>
          </span>
          <span>
            Employees assigned:{' '}
            <span className="text-zoru-ink">{assignedCount}</span>
          </span>
        </div>
      ) : null}
    </Card>
  );
}
