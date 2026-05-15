'use client';

/**
 * SabWa Group Categories — management page (SABWA_PLAN.md §6 page 7).
 *
 * - List existing categories with name + colour + icon + group-count.
 * - Reorder via up / down arrows (kept dependency-free; @dnd-kit is not a
 *   guaranteed install in this monorepo).
 * - Edit dialog: name, colour picker, curated lucide-icon picker.
 * - Bulk-assign mode: pick uncategorised groups and assign them to a
 *   category in one call.
 */

import * as React from 'react';
import {
  Award,
  Bell,
  Briefcase,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Edit,
  FolderTree,
  Heart,
  Home,
  Megaphone,
  Pencil,
  Plus,
  Smile,
  Star,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import {
  deleteGroupCategory,
  listGroupCategories,
  listGroups,
  setGroupCategory,
  upsertGroupCategory,
  type SabwaGroupCategory,
  type SabwaGroupSummary,
} from '@/app/actions/sabwa.actions';
import { useSabwaSession } from '@/lib/sabwa/session-context';

// ─── Static config (hoisted out of render) ──────────────────────────────────

const CURATED_ICONS: ReadonlyArray<{
  name: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { name: 'Tag', Icon: Tag },
  { name: 'Home', Icon: Home },
  { name: 'Briefcase', Icon: Briefcase },
  { name: 'Users', Icon: Users },
  { name: 'Heart', Icon: Heart },
  { name: 'Star', Icon: Star },
  { name: 'Megaphone', Icon: Megaphone },
  { name: 'Bell', Icon: Bell },
  { name: 'Smile', Icon: Smile },
  { name: 'Award', Icon: Award },
];

const ICON_BY_NAME = new Map(
  CURATED_ICONS.map(({ name, Icon }) => [name, Icon] as const),
);

const PRESET_COLORS: readonly string[] = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
];

// ─── Edit dialog ────────────────────────────────────────────────────────────

interface EditCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  category: SabwaGroupCategory | null;
  onSaved: () => void;
}

function EditCategoryDialog({
  open,
  onOpenChange,
  sessionId,
  category,
  onSaved,
}: EditCategoryDialogProps) {
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState(PRESET_COLORS[5]);
  const [icon, setIcon] = React.useState<string>('Tag');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setColor(category?.color ?? PRESET_COLORS[5]);
    setIcon(category?.icon ?? 'Tag');
  }, [open, category]);

  const onSave = React.useCallback(async () => {
    if (!sessionId) {
      toast({ title: 'No active session', variant: 'destructive' });
      return;
    }
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await upsertGroupCategory({
        sessionId,
        id: category?.id,
        name: name.trim(),
        color,
        icon,
      });
      if (res.ok) {
        toast({ title: category ? 'Category updated' : 'Category created' });
        onSaved();
        onOpenChange(false);
      } else {
        toast({
          title: 'Could not save category',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Could not save category',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, name, color, icon, category, onSaved, onOpenChange, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogDescription>
            Categories group related WhatsApp groups for faster triage.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Use ${c}`}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition',
                    color === c ? 'border-foreground' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="grid grid-cols-5 gap-2">
              {CURATED_ICONS.map(({ name: n, Icon }) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setIcon(n)}
                  aria-label={n}
                  className={cn(
                    'flex h-10 items-center justify-center rounded-md border transition',
                    icon === n
                      ? 'border-primary bg-secondary'
                      : 'border-border hover:bg-secondary',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Category row ───────────────────────────────────────────────────────────

interface CategoryRowProps {
  category: SabwaGroupCategory;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const CategoryRow = React.memo(function CategoryRow({
  category,
  isFirst,
  isLast,
  onMove,
  onEdit,
  onDelete,
}: CategoryRowProps) {
  const Icon = ICON_BY_NAME.get(category.icon ?? 'Tag') ?? Tag;
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div className="flex flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          aria-label="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onMove(1)}
          disabled={isLast}
          aria-label="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: category.color + '33' }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 truncate">
          <span className="truncate font-medium">{category.name}</span>
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: category.color }}
            aria-hidden
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {typeof category.groupCount === 'number'
            ? `${category.groupCount} group${category.groupCount === 1 ? '' : 's'}`
            : '— groups'}
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit category">
        <Edit className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        aria-label="Delete category"
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
});

// ─── Bulk-assign drawer ─────────────────────────────────────────────────────

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  categories: SabwaGroupCategory[];
  onDone: () => void;
}

function BulkAssignDialog({
  open,
  onOpenChange,
  sessionId,
  categories,
  onDone,
}: BulkAssignDialogProps) {
  const { toast } = useToast();
  const [uncategorised, setUncategorised] = React.useState<SabwaGroupSummary[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [targetCategoryId, setTargetCategoryId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || !sessionId) return;
    let cancelled = false;
    setLoading(true);
    listGroups({ sessionId })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setUncategorised(res.groups.filter((g) => !g.category));
        } else {
          setUncategorised([]);
        }
      })
      .catch(() => {
        if (!cancelled) setUncategorised([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  React.useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setTargetCategoryId(null);
    }
  }, [open]);

  const toggle = React.useCallback((jid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  }, []);

  const onApply = React.useCallback(async () => {
    if (!sessionId || !targetCategoryId || selected.size === 0) return;
    setSubmitting(true);
    try {
      const results = await Promise.all(
        Array.from(selected).map((jid) =>
          setGroupCategory({
            sessionId,
            groupJid: jid,
            categoryId: targetCategoryId,
          }).catch((err) => ({
            ok: false as const,
            error: err instanceof Error ? err.message : String(err),
          })),
        ),
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed === 0) {
        toast({ title: `Assigned ${selected.size} groups` });
        onDone();
        onOpenChange(false);
      } else {
        toast({
          title: 'Some assignments failed',
          description: `${results.length - failed} succeeded, ${failed} failed.`,
          variant: 'destructive',
        });
      }
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, targetCategoryId, selected, toast, onDone, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk-assign uncategorised groups</DialogTitle>
          <DialogDescription>
            Pick groups, then choose the category to assign them to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Target category</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {categories.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  Create a category first.
                </span>
              ) : (
                categories.map((c) => (
                  <Button
                    key={c.id}
                    variant={targetCategoryId === c.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTargetCategoryId(c.id)}
                  >
                    <span
                      className="mr-1.5 inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name}
                  </Button>
                ))
              )}
            </div>
          </div>

          <div>
            <Label>Uncategorised groups</Label>
            <ScrollArea className="mt-1 h-64 rounded-md border">
              <div className="divide-y">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="m-2 h-10" />
                  ))
                ) : uncategorised.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    No uncategorised groups.
                  </p>
                ) : (
                  uncategorised.map((g) => (
                    <label
                      key={g.jid}
                      className="flex cursor-pointer items-center gap-3 p-2.5 hover:bg-secondary"
                    >
                      <Checkbox
                        checked={selected.has(g.jid)}
                        onCheckedChange={() => toggle(g.jid)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{g.subject}</div>
                        <div className="text-xs text-muted-foreground">
                          {g.participantCount} members
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={onApply}
            disabled={submitting || !targetCategoryId || selected.size === 0}
          >
            {submitting ? 'Assigning…' : `Assign (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main client ────────────────────────────────────────────────────────────

export function CategoriesPageClient() {
  const { toast } = useToast();
  const { current } = useSabwaSession();
  const sessionId = current?.id ?? null;

  const [categories, setCategories] = React.useState<SabwaGroupCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState<SabwaGroupCategory | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<SabwaGroupCategory | null>(
    null,
  );
  const [bulkOpen, setBulkOpen] = React.useState(false);

  const fetchAll = React.useCallback(async () => {
    if (!sessionId) {
      setCategories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await listGroupCategories(sessionId).catch((err) => ({
        ok: false as const,
        error: err instanceof Error ? err.message : String(err),
      }));
      if (res.ok) {
        setCategories(
          [...res.categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        );
      } else {
        setCategories([]);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  React.useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const move = React.useCallback(
    async (index: number, direction: -1 | 1) => {
      if (!sessionId) return;
      const target = index + direction;
      if (target < 0 || target >= categories.length) return;
      const next = [...categories];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      setCategories(next); // optimistic
      // Persist new order. Use Promise.all to keep them parallel.
      await Promise.all(
        next.map((c, i) =>
          upsertGroupCategory({
            sessionId,
            id: c.id,
            name: c.name,
            color: c.color,
            icon: c.icon,
            order: i,
          }).catch(() => null),
        ),
      );
    },
    [categories, sessionId],
  );

  const onEdit = React.useCallback((cat: SabwaGroupCategory | null) => {
    setEditing(cat);
    setEditorOpen(true);
  }, []);

  const onConfirmDelete = React.useCallback(async () => {
    if (!pendingDelete) return;
    try {
      const res = await deleteGroupCategory(pendingDelete.id);
      if (res.ok) {
        toast({ title: 'Category deleted' });
        fetchAll();
      } else {
        toast({
          title: 'Could not delete',
          description: res.error,
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Could not delete',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setPendingDelete(null);
    }
  }, [pendingDelete, fetchAll, toast]);

  return (
    <div className="space-y-4 p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-secondary p-3">
            <FolderTree className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Group categories</h1>
            <p className="text-sm text-muted-foreground">
              Curate the buckets your groups live in.
            </p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setBulkOpen(true)}
            disabled={!sessionId}
          >
            <CheckSquare className="mr-1.5 h-4 w-4" />
            Bulk assign
          </Button>
          <Button onClick={() => onEdit(null)} disabled={!sessionId}>
            <Plus className="mr-1.5 h-4 w-4" />
            New category
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!sessionId ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Connect a SabWa session to manage categories.
            </p>
          ) : loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Tag className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No categories yet. Create one to get started.
              </p>
              <Button onClick={() => onEdit(null)}>
                <Plus className="mr-1.5 h-4 w-4" />
                New category
              </Button>
            </div>
          ) : (
            categories.map((cat, i) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                isFirst={i === 0}
                isLast={i === categories.length - 1}
                onMove={(dir) => move(i, dir)}
                onEdit={() => onEdit(cat)}
                onDelete={() => setPendingDelete(cat)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <EditCategoryDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        sessionId={sessionId}
        category={editing}
        onSaved={fetchAll}
      />

      <BulkAssignDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        sessionId={sessionId}
        categories={categories}
        onDone={fetchAll}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Groups tagged with{' '}
              <span className="font-medium">{pendingDelete?.name}</span> will become
              uncategorised. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Lint silencers for icons referenced only via the curated map.
void Pencil;
