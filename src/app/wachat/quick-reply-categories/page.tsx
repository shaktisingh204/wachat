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
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback,
  useMemo,
} from 'react';
import { Plus, Pencil, Trash2, Tag, Search } from 'lucide-react';
import { m } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getQuickReplyCategories,
  saveQuickReplyCategory,
  deleteQuickReplyCategory,
} from '@/app/actions/wachat-features.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

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
  const [search, setSearch] = useState('');

  const uiCategories = useMemo<UI_Category[]>(() => {
    const map = new Map<string, Category>(categories.map((c) => [c._id, c]));
    return categories
      .map((c) => {
        const parentNames: string[] = [];
        let curr = c.parentId ? map.get(c.parentId) : null;
        while (curr) {
          parentNames.unshift(curr.name);
          curr = curr.parentId ? map.get(curr.parentId) : null;
        }
        const displayName =
          parentNames.length > 0 ? `${parentNames.join(' > ')} > ${c.name}` : c.name;
        return { ...c, displayName };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [categories]);

  const validParents = useMemo(() => {
    if (!editing) return uiCategories;
    const invalidIds = new Set<string>();
    invalidIds.add(editing._id);
    let changed = true;
    while (changed) {
      changed = false;
      for (const cat of categories) {
        if (cat.parentId && invalidIds.has(cat.parentId) && !invalidIds.has(cat._id)) {
          invalidIds.add(cat._id);
          changed = true;
        }
      }
    }
    return uiCategories.filter((c) => !invalidIds.has(c._id));
  }, [uiCategories, editing, categories]);

  const filtered = useMemo(() => {
    if (!search.trim()) return uiCategories;
    const q = search.toLowerCase();
    return uiCategories.filter((c) => c.displayName.toLowerCase().includes(q));
  }, [uiCategories, search]);

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
      const res = await saveQuickReplyCategory(
        activeProjectId,
        name.trim(),
        editing?._id,
        parentId || null,
      );
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

  return (
    <WaPage>
      <PageHeader
        title="Quick reply categories"
        description="Organize your quick replies into categories for faster access during conversations."
        kicker="Wachat"
        eyebrowIcon={Tag}
        backHref="/wachat"
        actions={
          <WaButton leftIcon={Plus} onClick={openCreate}>
            New category
          </WaButton>
        }
      />

      {/* Search */}
      {categories.length > 0 && (
        <m.label
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          className="mb-6 flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 transition-colors focus-within:border-zinc-400 sm:max-w-md"
        >
          <Search className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories"
            className="w-full bg-transparent text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            aria-label="Search categories"
          />
        </m.label>
      )}

      {isPending && categories.length === 0 ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No categories yet"
          description="Group your quick replies under categories to make them easier to find."
          action={
            <WaButton leftIcon={Plus} onClick={openCreate}>
              New category
            </WaButton>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching categories"
          description="Try a different search term."
        />
      ) : (
        <Section padded={false}>
          <ul className="divide-y divide-zinc-100">
            {filtered.map((cat, i) => (
              <m.li
                key={cat._id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.28, delay: 0.02 + i * 0.025, ease: EASE_OUT }}
                className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-50"
              >
                <span
                  className="grid h-8 w-8 place-items-center rounded-lg"
                  style={{ background: 'var(--mt-accent-soft)' }}
                >
                  <Tag className="h-3.5 w-3.5" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-zinc-950">{cat.displayName}</div>
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-zinc-600">
                  {cat.count ?? 0} replies
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.97]"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(cat)}
                    className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.97]"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                  </button>
                </div>
              </m.li>
            ))}
          </ul>
        </Section>
      )}

      {/* Create / edit dialog */}
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
            <ZoruDialogTitle>{editing ? 'Edit category' : 'New category'}</ZoruDialogTitle>
            <ZoruDialogDescription>Give the category a short, recognizable name.</ZoruDialogDescription>
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
                className="rounded-xl"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="parent-category">Parent category</Label>
              <Select
                value={parentId || 'none'}
                onValueChange={(val) => setParentId(val === 'none' ? '' : val)}
              >
                <SelectTrigger id="parent-category" className="rounded-xl">
                  <SelectValue placeholder="Select parent category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level)</SelectItem>
                  {validParents.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ZoruDialogFooter>
            <WaButton
              variant="outline"
              size="sm"
              onClick={() => {
                setCreateOpen(false);
                setEditing(null);
                setName('');
                setParentId('');
              }}
            >
              Cancel
            </WaButton>
            <WaButton size="sm" onClick={handleSave} disabled={isPending || !name.trim()}>
              {editing ? 'Save changes' : 'Create category'}
            </WaButton>
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
            <ZoruAlertDialogTitle>Delete "{deleting?.name}"?</ZoruAlertDialogTitle>
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
            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </WaPage>
  );
}
