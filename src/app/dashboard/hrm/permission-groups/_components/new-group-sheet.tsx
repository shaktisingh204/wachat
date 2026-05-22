'use client';

/**
 * <NewGroupSheet /> — slide-over drawer for creating a new permission group.
 * Includes name, description, and the full <PermissionMatrix />.
 */

import * as React from 'react';
import { Plus } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetTrigger,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { createPermissionGroup } from '@/app/actions/hrm-permission-groups.actions';
import type { ModulePermission } from '@/app/actions/hrm-permission-groups.actions';
import { PermissionMatrix } from './permission-matrix';

interface NewGroupSheetProps {
  onCreated: () => void;
}

export function NewGroupSheet({ onCreated }: NewGroupSheetProps): React.JSX.Element {
  const { toast } = useZoruToast();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [permissions, setPermissions] = React.useState<ModulePermission[]>([]);
  const [saving, setSaving] = React.useState(false);

  const reset = React.useCallback(() => {
    setName('');
    setDescription('');
    setPermissions([]);
  }, []);

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) reset();
    },
    [reset],
  );

  const handleSave = React.useCallback(async () => {
    if (!name.trim()) {
      toast({ title: 'Group name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await createPermissionGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        permissions,
      });
      if (res.success) {
        toast({ title: 'Permission group created' });
        handleOpenChange(false);
        onCreated();
      } else {
        toast({
          title: res.error ?? 'Failed to create group',
          variant: 'destructive',
        });
      }
    } finally {
      setSaving(false);
    }
  }, [name, description, permissions, toast, handleOpenChange, onCreated]);

  return (
    <ZoruSheet open={open} onOpenChange={handleOpenChange}>
      <ZoruSheetTrigger asChild>
        <ZoruButton>
          <Plus className="h-4 w-4" />
          New Group
        </ZoruButton>
      </ZoruSheetTrigger>

      <ZoruSheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-2xl"
      >
        <ZoruSheetHeader>
          <ZoruSheetTitle>New Permission Group</ZoruSheetTitle>
          <ZoruSheetDescription>
            Define a named set of module permissions. Assign this group to
            employees from the &ldquo;Manage Assignments&rdquo; panel.
          </ZoruSheetDescription>
        </ZoruSheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto py-4">
          {/* Name */}
          <div className="space-y-2">
            <ZoruLabel htmlFor="new-grp-name">
              Group name <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="new-grp-name"
              placeholder="e.g. Team Lead, Developer, Manager"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <ZoruLabel htmlFor="new-grp-desc">Description</ZoruLabel>
            <ZoruTextarea
              id="new-grp-desc"
              placeholder="Optional notes about this permission group…"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Permission matrix */}
          <div className="space-y-2">
            <ZoruLabel>Module Permissions</ZoruLabel>
            <PermissionMatrix value={permissions} onChange={setPermissions} />
          </div>
        </div>

        <ZoruSheetFooter className="gap-2 pt-4">
          <ZoruButton
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </ZoruButton>
          <ZoruButton onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create Group'}
          </ZoruButton>
        </ZoruSheetFooter>
      </ZoruSheetContent>
    </ZoruSheet>
  );
}
