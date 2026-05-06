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

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
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
  const { toast } = useZoruToast();
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
            <ZoruButton variant="outline" asChild>
              <Link href="/dashboard/crm/settings/custom-fields/groups">
                <FolderTree className="h-4 w-4" />
                Manage Groups
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href="/dashboard/crm/settings/custom-fields/new">
                <Plus className="h-4 w-4" />
                Add Field
              </Link>
            </ZoruButton>
          </div>
        }
      />

      {isLoading && groups.length === 0 ? (
        <ZoruCard className="p-6">
          <p className="text-[13px] text-zoru-ink-muted">Loading…</p>
        </ZoruCard>
      ) : groups.length === 0 ? (
        <ZoruCard className="p-6">
          <div className="text-center">
            <p className="text-[13px] text-zoru-ink-muted">
              No groups yet. Create a group first, then add fields to it.
            </p>
            <div className="mt-4">
              <ZoruButton asChild>
                <Link href="/dashboard/crm/settings/custom-fields/groups">
                  Create a Group
                </Link>
              </ZoruButton>
            </div>
          </div>
        </ZoruCard>
      ) : (
        groups.map((group) => {
          const groupFields = fields
            .filter((f) => String(f.group_id) === String(group._id))
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
          return (
            <ZoruCard key={group._id} className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] text-zoru-ink">{group.name}</h2>
                  <ZoruBadge variant="default">{group.belongs_to}</ZoruBadge>
                </div>
                <ZoruButton variant="outline" asChild>
                  <Link
                    href={`/dashboard/crm/settings/custom-fields/new?group=${group._id}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add field
                  </Link>
                </ZoruButton>
              </div>

              <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <ZoruTable>
                  <ZoruTableHeader>
                    <ZoruTableRow className="hover:bg-transparent">
                      <ZoruTableHead className="text-zoru-ink-muted">Label</ZoruTableHead>
                      <ZoruTableHead className="text-zoru-ink-muted">Slug</ZoruTableHead>
                      <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                      <ZoruTableHead className="text-zoru-ink-muted">Required</ZoruTableHead>
                      <ZoruTableHead className="text-zoru-ink-muted">In Table</ZoruTableHead>
                      <ZoruTableHead className="w-[180px] text-right text-zoru-ink-muted">
                        Actions
                      </ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {groupFields.length === 0 ? (
                      <ZoruTableRow>
                        <ZoruTableCell
                          colSpan={6}
                          className="h-20 text-center text-[13px] text-zoru-ink-muted"
                        >
                          No fields yet.
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ) : (
                      groupFields.map((field, idx) => (
                        <ZoruTableRow key={field._id}>
                          <ZoruTableCell className="text-[13px] text-zoru-ink">
                            {field.label}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                            {field.name}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ZoruBadge variant="ghost">{field.type}</ZoruBadge>
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ZoruBadge variant={field.is_required ? 'warning' : 'ghost'}>
                              {field.is_required ? 'Yes' : 'No'}
                            </ZoruBadge>
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ZoruBadge variant={field.display_in_table ? 'success' : 'ghost'}>
                              {field.display_in_table ? 'Yes' : 'No'}
                            </ZoruBadge>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                disabled={idx === 0 || isPending}
                                onClick={() =>
                                  move(String(group._id), field._id, -1)
                                }
                                aria-label="Move up"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </ZoruButton>
                              <ZoruButton
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
                              </ZoruButton>
                              <ZoruButton variant="ghost" size="sm" asChild aria-label="Edit">
                                <Link
                                  href={`/dashboard/crm/settings/custom-fields/new?group=${group._id}&id=${field._id}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Link>
                              </ZoruButton>
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingId(field._id)}
                                aria-label="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                              </ZoruButton>
                            </div>
                          </ZoruTableCell>
                        </ZoruTableRow>
                      ))
                    )}
                  </ZoruTableBody>
                </ZoruTable>
              </div>
            </ZoruCard>
          );
        })
      )}

      <ZoruAlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete custom field?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This will also invalidate the stored value for this slug on
              existing records.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
