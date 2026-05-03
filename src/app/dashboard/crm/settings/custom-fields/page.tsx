'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  FolderTree,
} from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  getCustomFieldGroups,
  getCustomFields,
  deleteCustomField,
  reorderCustomFields,
} from '@/app/actions/worksuite/meta.actions';
import type {
  WsCustomField,
  WsCustomFieldGroup,
} from '@/lib/worksuite/meta-types';

type FieldRow = WsCustomField & { _id: string };
type GroupRow = WsCustomFieldGroup & { _id: string };

/**
 * Custom field directory — lists groups with their fields and
 * provides move-up/down reorder plus inline edit/delete controls.
 */
export default function CustomFieldsPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isPending, startReorder] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const [g, f] = await Promise.all([
          getCustomFieldGroups() as Promise<GroupRow[]>,
          getCustomFields() as Promise<FieldRow[]>,
        ]);
        setGroups(Array.isArray(g) ? g : []);
        setFields(Array.isArray(f) ? f : []);
      } catch (e) {
        console.error('Failed to load custom fields:', e);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteCustomField(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Field removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  const move = (groupId: string, fieldId: string, dir: -1 | 1) => {
    const groupFields = fields
      .filter((f) => String(f.group_id) === String(groupId))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const idx = groupFields.findIndex((f) => f._id === fieldId);
    if (idx === -1) return;
    const j = idx + dir;
    if (j < 0 || j >= groupFields.length) return;
    const ordered = [...groupFields];
    [ordered[idx], ordered[j]] = [ordered[j], ordered[idx]];
    const orderedIds = ordered.map((f) => f._id);
    startReorder(async () => {
      const res = await reorderCustomFields(groupId, orderedIds);
      if (res.success) {
        refresh();
      } else {
        toast({
          title: 'Error',
          description: res.error || 'Reorder failed',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Custom Fields"
        subtitle="Extend any CRM entity with custom fields grouped by target module."
        icon={Layers}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/crm/settings/custom-fields/groups">
              <ClayButton
                variant="pill"
                leading={<FolderTree className="h-4 w-4" strokeWidth={1.75} />}
              >
                Manage Groups
              </ClayButton>
            </Link>
            <Link href="/dashboard/crm/settings/custom-fields/new">
              <ClayButton
                variant="obsidian"
                leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
              >
                Add Field
              </ClayButton>
            </Link>
          </div>
        }
      />

      {isLoading && groups.length === 0 ? (
        <ClayCard>
          <p className="text-[13px] text-muted-foreground">Loading…</p>
        </ClayCard>
      ) : groups.length === 0 ? (
        <ClayCard>
          <div className="text-center">
            <p className="text-[13px] text-muted-foreground">
              No groups yet. Create a group first, then add fields to it.
            </p>
            <div className="mt-4">
              <Link href="/dashboard/crm/settings/custom-fields/groups">
                <ClayButton variant="obsidian">Create a Group</ClayButton>
              </Link>
            </div>
          </div>
        </ClayCard>
      ) : (
        groups.map((group) => {
          const groupFields = fields
            .filter((f) => String(f.group_id) === String(group._id))
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
          return (
            <ClayCard key={group._id}>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-foreground">
                    {group.name}
                  </h2>
                  <ClayBadge tone="rose-soft">{group.belongs_to}</ClayBadge>
                </div>
                <Link
                  href={`/dashboard/crm/settings/custom-fields/new?group=${group._id}`}
                >
                  <ClayButton
                    variant="pill"
                    leading={<Plus className="h-3.5 w-3.5" strokeWidth={1.75} />}
                  >
                    Add field
                  </ClayButton>
                </Link>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Label</TableHead>
                      <TableHead className="text-muted-foreground">Slug</TableHead>
                      <TableHead className="text-muted-foreground">Type</TableHead>
                      <TableHead className="text-muted-foreground">Required</TableHead>
                      <TableHead className="text-muted-foreground">In Table</TableHead>
                      <TableHead className="w-[180px] text-right text-muted-foreground">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupFields.length === 0 ? (
                      <TableRow className="border-border">
                        <TableCell
                          colSpan={6}
                          className="h-20 text-center text-[13px] text-muted-foreground"
                        >
                          No fields yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      groupFields.map((field, idx) => (
                        <TableRow key={field._id} className="border-border">
                          <TableCell className="text-[13px] text-foreground">
                            {field.label}
                          </TableCell>
                          <TableCell className="text-[13px] text-muted-foreground">
                            {field.name}
                          </TableCell>
                          <TableCell>
                            <ClayBadge tone="neutral">{field.type}</ClayBadge>
                          </TableCell>
                          <TableCell>
                            <ClayBadge
                              tone={field.is_required ? 'amber' : 'neutral'}
                            >
                              {field.is_required ? 'Yes' : 'No'}
                            </ClayBadge>
                          </TableCell>
                          <TableCell>
                            <ClayBadge
                              tone={field.display_in_table ? 'green' : 'neutral'}
                            >
                              {field.display_in_table ? 'Yes' : 'No'}
                            </ClayBadge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={idx === 0 || isPending}
                                onClick={() =>
                                  move(String(group._id), field._id, -1)
                                }
                                aria-label="Move up"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={
                                  idx === groupFields.length - 1 || isPending
                                }
                                onClick={() =>
                                  move(String(group._id), field._id, 1)
                                }
                                aria-label="Move down"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                              <Link
                                href={`/dashboard/crm/settings/custom-fields/new?group=${group._id}&id=${field._id}`}
                              >
                                <Button variant="ghost" size="sm" aria-label="Edit">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingId(field._id)}
                                aria-label="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </ClayCard>
          );
        })
      )}

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete custom field?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will also invalidate the stored value for this slug on
              existing records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
