'use client';

/**
 * /wachat/quick-reply-categories — organize quick replies into categories.
 * ZoruUI: header + breadcrumb, ZoruDataTable for list, dialogs for
 * create/edit/delete. Empty state via ZoruEmptyState.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import { useProject } from '@/context/project-context';
import {
  getQuickReplyCategories,
  saveQuickReplyCategory,
} from '@/app/actions/wachat-features.actions';

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
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDataTable,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';

export const dynamic = 'force-dynamic';

interface Category {
  _id: string;
  name: string;
  count?: number;
}

export default function QuickReplyCategoriesPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<Category[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [name, setName] = useState('');

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getQuickReplyCategories(activeProjectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        setCategories((res.categories ?? []) as Category[]);
      }
    });
  }, [activeProjectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = () => {
    if (!activeProjectId || !name.trim()) return;
    startTransition(async () => {
      const res = await saveQuickReplyCategory(activeProjectId, name.trim());
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        toast({
          title: editing ? 'Category updated' : 'Category created',
          description: res.message ?? 'Saved.',
        });
        setName('');
        setCreateOpen(false);
        setEditing(null);
        fetchData();
      }
    });
  };

  const handleDelete = () => {
    if (!deleting) return;
    // No dedicated delete server action exposed yet — keep the dialog but
    // surface a friendly toast and refetch. Once the action ships, wire it.
    toast({
      title: 'Delete coming soon',
      description: 'A delete-category server action is on the way.',
    });
    setDeleting(null);
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCreateOpen(true);
  };
  const openEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setCreateOpen(true);
  };

  const columns = useMemo<ColumnDef<Category>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <span className="text-zoru-ink">{row.original.name}</span>
        ),
      },
      {
        id: 'count',
        header: 'Replies',
        cell: ({ row }) => (
          <ZoruBadge variant="outline">{row.original.count ?? 0}</ZoruBadge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <ZoruButton
              variant="ghost"
              size="icon-sm"
              aria-label="Edit"
              onClick={() => openEdit(row.original)}
            >
              <Pencil />
            </ZoruButton>
            <ZoruButton
              variant="ghost"
              size="icon-sm"
              aria-label="Delete"
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 />
            </ZoruButton>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Quick Reply Categories</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat · {activeProject?.name ?? 'Project'}</ZoruPageEyebrow>
          <ZoruPageTitle>Quick Reply Categories</ZoruPageTitle>
          <ZoruPageDescription>
            Organize your quick replies into categories for faster access during
            conversations.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton onClick={openCreate}>
            <Plus /> New category
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <div className="mt-6">
        {isPending && categories.length === 0 ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ZoruSkeleton key={i} className="h-12" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <ZoruEmptyState
            icon={<Tag />}
            title="No categories yet"
            description="Group your quick replies under categories to make them easier to find."
            action={
              <ZoruButton onClick={openCreate}>
                <Plus /> New category
              </ZoruButton>
            }
          />
        ) : (
          <ZoruCard className="p-4">
            <ZoruDataTable
              columns={columns}
              data={categories}
              filterColumn="name"
              filterPlaceholder="Search categories…"
            />
          </ZoruCard>
        )}
      </div>

      {/* Create / edit category dialog */}
      <ZoruDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setEditing(null);
            setName('');
          }
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit category' : 'New category'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Give the category a short, recognizable name.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="category-name">Name</ZoruLabel>
            <ZoruInput
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder="e.g. Sales"
              autoFocus
            />
          </div>

          <ZoruDialogFooter>
            <ZoruButton
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setEditing(null);
                setName('');
              }}
            >
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleSave} disabled={isPending || !name.trim()}>
              {editing ? 'Save changes' : 'Create category'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Delete category alert */}
      <ZoruAlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete &ldquo;{deleting?.name}&rdquo;?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This removes the category but leaves the underlying replies intact.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete}>
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
