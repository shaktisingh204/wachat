'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';
import { Briefcase, GitBranch, Layers, Search, TreePine } from 'lucide-react';
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
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    getDesignationTree,
    getDesignationsExt,
    saveDesignationExt,
    deleteDesignationExt,
    setDesignationParent,
} from '@/app/actions/worksuite/company.actions';
import type {
    WsHierarchyNode,
    WsDesignationExt,
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
    allNodes: WsDesignationExt[];
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
                className="flex items-center gap-2 border-b border-zoru-line py-2.5 last:border-b-0"
                style={{ paddingLeft: `${level * 20 + 8}px` }}
            >
                <ZoruButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
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
                </ZoruButton>

                <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-zoru-ink">{node.name}</div>
                    {node.description ? (
                        <div className="text-[11.5px] text-zoru-ink-muted">{node.description}</div>
                    ) : null}
                </div>

                <div className="w-[220px] shrink-0">
                    <ZoruSelect
                        value={node.parent_id ?? '__none__'}
                        onValueChange={(v) =>
                            onSetParent(node._id, v === '__none__' ? null : v)
                        }
                    >
                        <ZoruSelectTrigger className="h-8 rounded-lg border-zoru-line bg-zoru-bg text-[12px]">
                            <ZoruSelectValue placeholder="No parent" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="__none__">— Root (no parent) —</ZoruSelectItem>
                            {validParents.map((p) => (
                                <ZoruSelectItem key={String(p._id)} value={String(p._id)}>
                                    {p.name}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>

                <ZoruButton
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(node._id)}
                    aria-label="Edit"
                >
                    <Pencil className="h-3.5 w-3.5" />
                </ZoruButton>
                <ZoruButton
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onDelete(node._id)}
                    aria-label="Delete"
                >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </ZoruButton>
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

function countNodes(nodes: WsHierarchyNode[]): number {
    return nodes.reduce((acc, n) => acc + 1 + countNodes(n.children), 0);
}

function maxDepth(nodes: WsHierarchyNode[], level = 0): number {
    if (nodes.length === 0) return level;
    return Math.max(...nodes.map((n) => maxDepth(n.children, level + 1)));
}

function countLeaves(nodes: WsHierarchyNode[]): number {
    return nodes.reduce(
        (acc, n) => acc + (n.children.length === 0 ? 1 : countLeaves(n.children)),
        0,
    );
}

function KpiCard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: number | string;
}) {
    return (
        <ZoruCard className="p-5">
            <div className="flex items-center gap-2 text-zoru-ink-muted">
                {icon}
                <p className="text-[12.5px] font-medium">{label}</p>
            </div>
            <div className="mt-2 text-[22px] font-semibold text-zoru-ink">
                {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
        </ZoruCard>
    );
}

export default function DesignationsHierarchyPage() {
    const { toast } = useZoruToast();
    const [tree, setTree] = useState<WsHierarchyNode[]>([]);
    const [flat, setFlat] = useState<WsDesignationExt[]>([]);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<WsDesignationExt | null>(null);
    const [search, setSearch] = useState('');
    const [isLoading, startLoading] = useTransition();
    const formRef = useRef<HTMLFormElement>(null);
    const [saveState, formAction, isSaving] = useActionState(
        saveDesignationExt,
        initialState,
    );

    const refresh = useCallback(() => {
        startLoading(async () => {
            const [t, f] = await Promise.all([
                getDesignationTree(),
                getDesignationsExt(),
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
        const r = await deleteDesignationExt(id);
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
        const r = await setDesignationParent(id, parentId);
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
        if (!editing?.parent_designation_id) return '__none__';
        return String(editing.parent_designation_id);
    }, [editing]);

    const totalDesignations = flat.length;
    const levels = maxDepth(tree);
    const leaves = countLeaves(tree);

    const searchLower = search.trim().toLowerCase();
    const matchedIds = useMemo(() => {
        if (!searchLower) return new Set<string>();
        return new Set(flat.filter((n) => n.name.toLowerCase().includes(searchLower)).map((n) => String(n._id)));
    }, [flat, searchLower]);

    return (
        <EntityListShell
            title="Designations — Hierarchy"
            subtitle="Nested job-title structure. Set a parent designation to model reporting chains."
            primaryAction={
                <ZoruButton onClick={handleAdd}>
                    <Plus className="h-4 w-4" />
                    Add Designation
                </ZoruButton>
            }
        >
            {/* KPI strip */}
            <div className="grid gap-3 sm:grid-cols-3">
                <KpiCard
                    icon={<Briefcase className="h-4 w-4" />}
                    label="Total designations"
                    value={totalDesignations}
                />
                <KpiCard
                    icon={<Layers className="h-4 w-4" />}
                    label="Hierarchy levels"
                    value={levels}
                />
                <KpiCard
                    icon={<TreePine className="h-4 w-4" />}
                    label="Leaf nodes"
                    value={leaves}
                />
            </div>

            <ZoruCard className="p-6">
                {/* Search bar */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[13px] text-zoru-ink-muted">
                        Set a parent via the dropdown on each row, or click a row to edit.
                    </p>
                    <div className="relative w-60">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zoru-ink-muted" />
                        <ZoruInput
                            placeholder="Search designations…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 text-[13px]"
                        />
                    </div>
                </div>

                {isLoading && tree.length === 0 ? (
                    <ZoruSkeleton className="h-[240px] w-full" />
                ) : tree.length === 0 ? (
                    <div className="py-10 text-center text-[13px] text-zoru-ink-muted">
                        No designations yet — click Add to get started.
                    </div>
                ) : matchedIds.size > 0 && searchLower ? (
                    /* Flat search results */
                    <div className="rounded-lg border border-zoru-line bg-zoru-bg">
                        {flat
                            .filter((n) => n.name.toLowerCase().includes(searchLower))
                            .map((n) => (
                                <div
                                    key={String(n._id)}
                                    className="flex items-center gap-2 border-b border-zoru-line px-4 py-2.5 last:border-b-0"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[13px] font-medium text-zoru-ink">{n.name}</div>
                                        {n.description ? (
                                            <div className="text-[11.5px] text-zoru-ink-muted">{n.description}</div>
                                        ) : null}
                                    </div>
                                    <ZoruButton
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleEdit(String(n._id))}
                                        aria-label="Edit"
                                    >
                                        <GitBranch className="h-3.5 w-3.5" />
                                    </ZoruButton>
                                </div>
                            ))}
                    </div>
                ) : (
                    <div className="rounded-lg border border-zoru-line bg-zoru-bg">
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
            </ZoruCard>

            <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle className="text-zoru-ink">
                            {editing ? 'Edit Designation' : 'Add Designation'}
                        </ZoruDialogTitle>
                        <ZoruDialogDescription className="text-zoru-ink-muted">
                            Provide a name, optional description, and parent designation.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <form action={formAction} ref={formRef} className="space-y-4">
                        {editing?._id ? (
                            <input type="hidden" name="_id" value={String(editing._id)} />
                        ) : null}
                        <div>
                            <ZoruLabel htmlFor="name" className="text-[13px] text-zoru-ink">
                                Name <span className="text-red-500">*</span>
                            </ZoruLabel>
                            <ZoruInput
                                id="name"
                                name="name"
                                required
                                defaultValue={editing?.name ?? ''}
                                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>
                        <div>
                            <ZoruLabel htmlFor="description" className="text-[13px] text-zoru-ink">
                                Description
                            </ZoruLabel>
                            <ZoruTextarea
                                id="description"
                                name="description"
                                rows={2}
                                defaultValue={editing?.description ?? ''}
                                className="mt-1.5 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>
                        <div>
                            <ZoruLabel
                                htmlFor="parent_designation_id"
                                className="text-[13px] text-zoru-ink"
                            >
                                Parent Designation
                            </ZoruLabel>
                            <ZoruSelect
                                name="parent_designation_id"
                                defaultValue={editingParent}
                            >
                                <ZoruSelectTrigger
                                    id="parent_designation_id"
                                    className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                >
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="__none__">— Root (no parent) —</ZoruSelectItem>
                                    {flat
                                        .filter((p) => String(p._id) !== String(editing?._id))
                                        .map((p) => (
                                            <ZoruSelectItem key={String(p._id)} value={String(p._id)}>
                                                {p.name}
                                            </ZoruSelectItem>
                                        ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                            <p className="mt-1 text-[11px] text-zoru-ink-muted">
                                Select &quot;Root&quot; to make this a top-level designation.
                            </p>
                        </div>
                        <ZoruDialogFooter>
                            <ZoruButton
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                            >
                                Cancel
                            </ZoruButton>
                            <ZoruButton
                                type="submit"
                                disabled={isSaving}
                            >
                                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                                Save
                            </ZoruButton>
                        </ZoruDialogFooter>
                    </form>
                </ZoruDialogContent>
            </ZoruDialog>
        </EntityListShell>
    );
}
