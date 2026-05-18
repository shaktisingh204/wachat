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
    BadgeCheck,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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

export default function DesignationsHierarchyPage() {
    const { toast } = useZoruToast();
    const [tree, setTree] = useState<WsHierarchyNode[]>([]);
    const [flat, setFlat] = useState<WsDesignationExt[]>([]);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<WsDesignationExt | null>(null);
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

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Designations — Hierarchy"
                subtitle="Nested job-title structure. Set a parent designation to model reporting chains."
                icon={BadgeCheck}
                actions={
                    <ZoruButton onClick={handleAdd}>
                        <Plus className="h-4 w-4" />
                        Add Designation
                    </ZoruButton>
                }
            />

            <ZoruCard className="p-6">
                {isLoading && tree.length === 0 ? (
                    <ZoruSkeleton className="h-[240px] w-full" />
                ) : tree.length === 0 ? (
                    <div className="py-10 text-center text-[13px] text-zoru-ink-muted">
                        No designations yet — click Add to get started.
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
        </div>
    );
}
