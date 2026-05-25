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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  deleteQuickReplyCategory,
  } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/quick-reply-categories — organize quick replies into categories.
 * ZoruUI: header + breadcrumb, DataTable for list, dialogs for
 * create/edit/delete. Empty state via EmptyState.
 */

import * as React from 'react';

interface Category {
  _id: string;
  name: string;
  parentId?: string | null;
  count?: number;
}

interface UI_Category extends Category {
  displayName: string;
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
  const [parentId, setParentId] = useState('');

  const uiCategories = useMemo<UI_Category[]>(() => {
    const map = new Map<string, Category>(categories.map(c => [c._id, c]));
    return categories.map(c => {
      let parentNames = [];
      let curr = c.parentId ? map.get(c.parentId) : null;
      while(curr) {
         parentNames.unshift(curr.name);
         curr = curr.parentId ? map.get(curr.parentId) : null;
      }
      const displayName = parentNames.length > 0 ? `${parentNames.join(' > ')} > ${c.name}` : c.name;
      return { ...c, displayName };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [categories]);

  const validParents = useMemo(() => {
    if (!editing) return uiCategories;
    const invalidIds = new Set<string>();
    invalidIds.add(editing._id);
    let changed = true;
    while(changed) {
       changed = false;
       for (const cat of categories) {
           if (cat.parentId && invalidIds.has(cat.parentId) && !invalidIds.has(cat._id)) {
              invalidIds.add(cat._id);
              changed = true;
           }
       }
    }
    return uiCategories.filter(c => !invalidIds.has(c._id));
  }, [uiCategories, editing, categories]);

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
      const res = await saveQuickReplyCategory(activeProjectId, name.trim(), editing?._id, parentId || null);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        toast({
          title: editing ? 'Category updated' : 'Category created',
          description: res.message ?? 'Saved.',
        });
        setName('');
        setParentId('');
        setCreateOpen(false);
        setEditing(null);
        fetchData();
      }
    });
  };

  const handleDelete = () => {
    if (!deleting) return;
    startTransition(async () => {
      const res = await deleteQuickReplyCategory(deleting._id);
      if (res.error) {
         toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
         toast({ title: 'Deleted', description: 'Category deleted successfully.' });
         setDeleting(null);
         fetchData();
      }
    });
  };

  const openCreate = () => {
    setEditing(null);
    setName('');
    setParentId('');
    setCreateOpen(true);
  };
  const openEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setParentId(cat.parentId || '');
    setCreateOpen(true);
  };

  const columns = useMemo<ColumnDef<UI_Category>[]>(
    () => [
      {
        accessorKey: 'displayName',
        header: 'Name',
        cell: ({ row }) => (
          <span className="text-zoru-ink">{row.original.displayName}</span>
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
              data={uiCategories}
              filterColumn="displayName"
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
            setParentId('');
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

          <div className="flex flex-col gap-3">
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="parent-category">Parent Category</Label>
              <Select
                value={parentId || 'none'}
                onValueChange={(val) => setParentId(val === 'none' ? '' : val)}
              >
                <SelectTrigger id="parent-category">
                  <SelectValue placeholder="Select parent category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Top-level)</SelectItem>
                  {validParents.map(c => (
                    <SelectItem key={c._id} value={c._id}>{c.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ZoruDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setEditing(null);
                setName('');
                setParentId('');
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
              {deleting?.count ? (
                <>
                  This category contains <strong>{deleting.count} quick repl{deleting.count === 1 ? 'y' : 'ies'}</strong>. 
                  Deleting it will leave these replies without a category, but they will not be deleted.
                </>
              ) : (
                'This removes the category but leaves any underlying replies intact.'
              )}
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
