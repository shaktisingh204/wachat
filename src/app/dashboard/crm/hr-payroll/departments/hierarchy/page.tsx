'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  Building,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getDepartmentTree,
  getDepartmentsExt,
  saveDepartmentExt,
  deleteDepartmentExt,
  setDepartmentParent,
} from '@/app/actions/worksuite/company.actions';
import type {
  WsHierarchyNode,
  WsDepartmentExt,
} from '@/lib/worksuite/company-types';

type FormState = { message?: string; error?: string; id?: string };
const initialState: FormState = {};

function TreeRow({
  node,
  level,
  allNodes,
  expanded,
  toggle,
  onEdit,
  onDelete,
  onSetParent,
}: {
  node: WsHierarchyNode;
  level: number;
  allNodes: WsDepartmentExt[];
  expanded: Record<string, boolean>;
  toggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSetParent: (id: string, parentId: string | null) => void;
}) {
  const isOpen = expanded[node._id] ?? true;
  const hasChildren = node.children.length > 0;
  const validParents = allNodes.filter((n) => String(n._id) !== node._id);

  return (
    <div>
      <div
        className="flex items-center gap-2 border-b border-clay-border py-2.5 last:border-b-0"
        style={{ paddingLeft: `${level * 20}px` }}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => hasChildren && toggle(node._id)}
          aria-label={isOpen ? 'Collapse' : 'Expand'}
        >
          {hasChildren ? (
            isOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="inline-block h-3.5 w-3.5" />
          )}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-clay-ink">{node.name}</div>
          {node.description ? (
            <div className="text-[11.5px] text-clay-ink-muted">
              {node.description}
            </div>
          ) : null}
        </div>

        <div className="w-[220px] shrink-0">
          <Select
            value={node.parent_id ?? '__none__'}
            onValueChange={(v) =>
              onSetParent(node._id, v === '__none__' ? null : v)
            }
          >
            <SelectTrigger className="h-8 rounded-clay-md border-clay-border bg-clay-surface text-[12px]">
              <SelectValue placeholder="No parent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Root (no parent) —</SelectItem>
              {validParents.map((p) => (
                <SelectItem key={String(p._id)} value={String(p._id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onEdit(node._id)}
          aria-label="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onDelete(node._id)}
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5 text-clay-red" />
        </Button>
      </div>
      {hasChildren && isOpen ? (
        <div>
          {node.children.map((c) => (
            <TreeRow
              key={c._id}
              node={c}
              level={level + 1}
              allNodes={allNodes}
              expanded={expanded}
              toggle={toggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onSetParent={onSetParent}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function DepartmentsHierarchyPage() {
  const { toast } = useToast();
  const [tree, setTree] = useState<WsHierarchyNode[]>([]);
  const [flat, setFlat] = useState<WsDepartmentExt[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WsDepartmentExt | null>(null);
  const [isLoading, startLoading] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [saveState, formAction, isSaving] = useActionState(
    saveDepartmentExt,
    initialState,
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [t, f] = await Promise.all([
        getDepartmentTree(),
        getDepartmentsExt(),
      ]);
      setTree(t);
      setFlat(f);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      setDialogOpen(false);
      setEditing(null);
      refresh();
    }
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  const toggle = (id: string) =>
    setExpanded((p) => ({ ...p, [id]: !(p[id] ?? true) }));

  const handleEdit = (id: string) => {
    const row = flat.find((r) => String(r._id) === id) || null;
    setEditing(row);
    setDialogOpen(true);
  };
  const handleAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const handleDelete = async (id: string) => {
    const r = await deleteDepartmentExt(id);
    if (r.success) {
      toast({ title: 'Deleted' });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: r.error,
        variant: 'destructive',
      });
    }
  };
  const handleSetParent = async (id: string, parentId: string | null) => {
    const r = await setDepartmentParent(id, parentId);
    if (r.success) {
      toast({ title: 'Hierarchy updated' });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: r.error,
        variant: 'destructive',
      });
    }
  };

  const editingParent = useMemo(() => {
    if (!editing?.parent_department_id) return '__none__';
    return String(editing.parent_department_id);
  }, [editing]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Departments — Hierarchy"
        subtitle="Nested org structure. Set a parent for each department to build the tree."
        icon={Building}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" />}
            onClick={handleAdd}
          >
            Add Department
          </ClayButton>
        }
      />

      <ClayCard>
        {isLoading && tree.length === 0 ? (
          <Skeleton className="h-[240px] w-full" />
        ) : tree.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-clay-ink-muted">
            No departments yet — click Add to get started.
          </div>
        ) : (
          <div className="rounded-clay-md border border-clay-border bg-clay-surface">
            {tree.map((n) => (
              <TreeRow
                key={n._id}
                node={n}
                level={0}
                allNodes={flat}
                expanded={expanded}
                toggle={toggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSetParent={handleSetParent}
              />
            ))}
          </div>
        )}
      </ClayCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-clay-ink">
              {editing ? 'Edit Department' : 'Add Department'}
            </DialogTitle>
            <DialogDescription className="text-clay-ink-muted">
              Provide a name, optional description, and parent department.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} ref={formRef} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={String(editing._id)} />
            ) : null}
            <div>
              <Label htmlFor="name" className="text-[13px] text-clay-ink">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={editing?.name ?? ''}
                className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="description" className="text-[13px] text-clay-ink">
                Description
              </Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={editing?.description ?? ''}
                className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              />
            </div>
            <div>
              <Label
                htmlFor="parent_department_id"
                className="text-[13px] text-clay-ink"
              >
                Parent Department
              </Label>
              <Select
                name="parent_department_id"
                defaultValue={editingParent}
              >
                <SelectTrigger
                  id="parent_department_id"
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Root (no parent) —</SelectItem>
                  {flat
                    .filter((p) => String(p._id) !== String(editing?._id))
                    .map((p) => (
                      <SelectItem key={String(p._id)} value={String(p._id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-clay-ink-muted">
                Select “Root” to make this a top-level department.
              </p>
            </div>
            <DialogFooter>
              <ClayButton
                type="button"
                variant="pill"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </ClayButton>
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isSaving}
                leading={
                  isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : undefined
                }
              >
                Save
              </ClayButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
