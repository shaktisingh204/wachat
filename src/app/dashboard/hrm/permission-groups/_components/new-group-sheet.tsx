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
import { GroupForm } from './group-form';

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
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <ZoruSheetTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          New Group
        </Button>
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
          <GroupForm
            name={name}
            description={description}
            permissions={permissions}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onPermissionsChange={setPermissions}
          />
        </div>

        <ZoruSheetFooter className="gap-2 pt-4">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create Group'}
          </Button>
        </ZoruSheetFooter>
      </ZoruSheetContent>
    </Sheet>
  );
}
