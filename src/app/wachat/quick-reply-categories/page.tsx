'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SelectField as Select,
  type SelectOption,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo } from 'react';
import { Plus,
  Pencil,
  Trash2,
  Tag,
  Search } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import {
  getQuickReplyCategories,
  saveQuickReplyCategory,
  deleteQuickReplyCategory,
  } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/quick-reply-categories — organize quick replies into categories.
 * 20ui: WachatPage frame (title/description/breadcrumb), DataTable for list,
 * Modal for create/edit, AlertDialog for delete. Empty state via EmptyState.
 */

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
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState<Category[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [search, setSearch] = useState('');

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

  const filteredCategories = useMemo<UI_Category[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return uiCategories;
    return uiCategories.filter(c => c.displayName.toLowerCase().includes(q));
  }, [uiCategories, search]);

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

  const parentOptions = useMemo<SelectOption[]>(
    () => [
      { value: 'none', label: 'None (Top-level)' },
      ...validParents.map(c => ({ value: c._id, label: c.displayName })),
    ],
    [validParents],
  );

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getQuickReplyCategories(activeProjectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
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
        toast({ title: 'Error', description: res.error, tone: 'danger' });
      } else {
        toast({
          title: editing ? 'Category updated' : 'Category created',
          description: res.message ?? 'Saved.',
          tone: 'success',
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
         toast({ title: 'Error', description: res.error, tone: 'danger' });
      } else {
         toast({ title: 'Deleted', description: 'Category deleted successfully.', tone: 'success' });
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

  const closeCreate = () => {
    setCreateOpen(false);
    setEditing(null);
    setName('');
    setParentId('');
  };

  const columns = useMemo<DataTableColumn<UI_Category>[]>(
    () => [
      {
        key: 'displayName',
        header: 'Name',
        sortable: true,
        render: (row) => (
          <span className="st-text">{row.displayName}</span>
        ),
      },
      {
        key: 'count',
        header: 'Replies',
        sortable: true,
        sortValue: (row) => row.count ?? 0,
        render: (row) => (
          <Badge kind="outline">{row.count ?? 0}</Badge>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">
            <IconButton
              variant="ghost"
              size="sm"
              label="Edit"
              icon={Pencil}
              onClick={() => openEdit(row)}
            />
            <IconButton
              variant="ghost"
              size="sm"
              label="Delete"
              icon={Trash2}
              onClick={() => setDeleting(row)}
            />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Quick Reply Categories' },
      ]}
      eyebrow={`WaChat · ${activeProject?.name ?? 'Project'}`}
      title="Quick Reply Categories"
      description="Organize your quick replies into categories for faster access during conversations."
      actions={
        <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
          New category
        </Button>
      }
    >
      {isPending && categories.length === 0 ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={48} />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No categories yet"
          description="Group your quick replies under categories to make them easier to find."
          action={
            <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
              New category
            </Button>
          }
        />
      ) : (
        <Card padding="md">
          <div className="mb-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories…"
              iconLeft={Search}
              aria-label="Search categories"
            />
          </div>
          <DataTable
            columns={columns}
            rows={filteredCategories}
            getRowId={(row) => row._id}
            empty={
              <EmptyState
                size="sm"
                icon={Search}
                title="No matches"
                description="No categories match your search."
              />
            }
          />
        </Card>
      )}

      {/* Create / edit category modal */}
      <Modal
        open={createOpen}
        onClose={closeCreate}
        title={editing ? 'Edit category' : 'New category'}
        description="Give the category a short, recognizable name."
        footer={
          <>
            <Button variant="outline" onClick={closeCreate}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={isPending || !name.trim()}
            >
              {editing ? 'Save changes' : 'Create category'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder="e.g. Sales"
              autoFocus
            />
          </Field>
          <Field label="Parent Category">
            <Select
              value={parentId || 'none'}
              onChange={(val) => setParentId(val === 'none' || val == null ? '' : val)}
              options={parentOptions}
              placeholder="Select parent category (optional)"
              searchable
            />
          </Field>
        </div>
      </Modal>

      {/* Delete category alert */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{deleting?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.count ? (
                <>
                  This category contains <strong>{deleting.count} quick repl{deleting.count === 1 ? 'y' : 'ies'}</strong>.
                  Deleting it will leave these replies without a category, but they will not be deleted.
                </>
              ) : (
                'This removes the category but leaves any underlying replies intact.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WachatPage>
  );
}
