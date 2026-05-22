'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  DataTable,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  EmptyState,
  Input,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Skeleton,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo } from 'react';
import { Plus,
  Pencil,
  Trash2,
  Tag } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import { useProject } from '@/context/project-context';
import {
  getQuickReplyCategories,
  saveQuickReplyCategory,
  } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/quick-reply-categories — organize quick replies into categories.
 * ZoruUI: header + breadcrumb, DataTable for list, dialogs for
 * create/edit/delete. Empty state via EmptyState.
 */

import * as React from 'react';

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
          <Badge variant="outline">{row.original.count ?? 0}</Badge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit"
              onClick={() => openEdit(row.original)}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete"
              onClick={() => setDeleting(row.original)}
            >
              <Trash2 />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
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
      </Breadcrumb>

      <PageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>WaChat · {activeProject?.name ?? 'Project'}</ZoruPageEyebrow>
          <ZoruPageTitle>Quick Reply Categories</ZoruPageTitle>
          <ZoruPageDescription>
            Organize your quick replies into categories for faster access during
            conversations.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button onClick={openCreate}>
            <Plus /> New category
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="mt-6">
        {isPending && categories.length === 0 ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={<Tag />}
            title="No categories yet"
            description="Group your quick replies under categories to make them easier to find."
            action={
              <Button onClick={openCreate}>
                <Plus /> New category
              </Button>
            }
          />
        ) : (
          <Card className="p-4">
            <DataTable
              columns={columns}
              data={categories}
              filterColumn="name"
              filterPlaceholder="Search categories…"
            />
          </Card>
        )}
      </div>

      {/* Create / edit category dialog */}
      <Dialog
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
            <Label htmlFor="category-name">Name</Label>
            <Input
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
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setEditing(null);
                setName('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending || !name.trim()}>
              {editing ? 'Save changes' : 'Create category'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

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
