'use client';

import {
  Input,
  Label,
  Textarea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Card,
  Button,
  Badge,
  useZoruToast,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useActionState,
  useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle,
  Trash2,
  Pencil,
  Plus,
  X } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    getCrmDesignations,
    saveCrmDesignation,
    deleteCrmDesignation,
    getCrmDepartments,
} from '@/app/actions/crm-employees.actions';
import type { WithId, CrmDesignation, CrmDepartment } from '@/lib/definitions';

const saveInitialState: any = { message: null, error: null };

const GRADE_OPTIONS = [
    'L1 — Junior', 'L2 — Mid', 'L3 — Senior', 'L4 — Lead',
    'L5 — Principal', 'L6 — Staff', 'L7 — Director', 'L8 — VP', 'L9 — C-Level',
];

function SaveButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {label}
        </ZoruButton>
    );
}

export default function DesignationsPage() {
    const [designations, setDesignations] = useState<WithId<CrmDesignation>[]>([]);
    const [departments, setDepartments] = useState<WithId<CrmDepartment>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(saveCrmDesignation, saveInitialState);
    const { toast } = useZoruToast();
    const formRef = useRef<HTMLFormElement>(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<WithId<CrmDesignation> | null>(null);
    const [deptId, setDeptId] = useState('__none__');
    const [level, setLevel] = useState('__none__');

    const fetchData = useCallback(() => {
        startLoading(async () => {
            const [desigs, depts] = await Promise.all([
                getCrmDesignations(),
                getCrmDepartments(),
            ]);
            setDesignations(desigs);
            setDepartments(depts);
        });
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (saveState.message) {
            toast({ title: 'Success', description: saveState.message });
            fetchData();
            formRef.current?.reset();
            setDialogOpen(false);
            setEditing(null);
            setDeptId('__none__');
            setLevel('__none__');
        }
        if (saveState.error) {
            toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
        }
    }, [saveState, toast, fetchData]);

    const [deleteTransition, startDeleteTransition] = useTransition();

    const handleDelete = (desig: WithId<CrmDesignation>) => {
        startDeleteTransition(async () => {
            const result = await deleteCrmDesignation(desig._id.toString());
            if (result.success) {
                toast({ title: 'Deleted', description: `"${desig.name}" removed.` });
                fetchData();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    const openAdd = () => {
        setEditing(null);
        setDeptId('__none__');
        setLevel('__none__');
        setDialogOpen(true);
    };

    const openEdit = (desig: WithId<CrmDesignation>) => {
        setEditing(desig);
        setDeptId((desig as any).department_id ?? '__none__');
        setLevel((desig as any).level ?? '__none__');
        setDialogOpen(true);
    };

    const deptNameById = departments.reduce<Record<string, string>>((acc, d) => {
        acc[d._id.toString()] = d.name;
        return acc;
    }, {});

    return (
        <EntityListShell
            title="Designations"
            subtitle="Manage job titles with department mapping and grade levels."
            primaryAction={
                <ZoruButton onClick={openAdd}>
                    <Plus className="h-4 w-4" />
                    Add Designation
                </ZoruButton>
            }
        >

            <ZoruCard className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[16px] text-zoru-ink">All Designations</h2>
                    <ZoruBadge variant="secondary">{designations.length} total</ZoruBadge>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Designation</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Department</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Level / Grade</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </td>
                                </tr>
                            ) : designations.length > 0 ? (
                                designations.map((desig) => {
                                    const deptName = (desig as any).department_id
                                        ? deptNameById[(desig as any).department_id.toString()] ?? '—'
                                        : '—';
                                    return (
                                        <tr key={desig._id.toString()} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="text-zoru-ink">{desig.name}</div>
                                                {desig.description ? (
                                                    <div className="text-[11.5px] text-zoru-ink-muted">{desig.description}</div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3 text-zoru-ink-muted">{deptName}</td>
                                            <td className="px-4 py-3">
                                                {(desig as any).level ? (
                                                    <ZoruBadge variant="info">{(desig as any).level}</ZoruBadge>
                                                ) : (
                                                    <span className="text-zoru-ink-muted">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEdit(desig)}
                                                        aria-label="Edit"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(desig)}
                                                        disabled={deleteTransition}
                                                        aria-label="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                                    </ZoruButton>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                        No designations yet. Click &quot;Add Designation&quot; to create one.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </ZoruCard>

            <ZoruDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle className="text-zoru-ink">
                            {editing ? 'Edit Designation' : 'Add Designation'}
                        </ZoruDialogTitle>
                        <ZoruDialogDescription className="text-zoru-ink-muted">
                            Fill in the designation details. Only the name is required.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <form action={formAction} ref={formRef} className="space-y-4">
                        {editing?._id ? (
                            <input type="hidden" name="_id" value={editing._id.toString()} />
                        ) : null}

                        <input type="hidden" name="department_id" value={deptId === '__none__' ? '' : deptId} />
                        <input type="hidden" name="level" value={level === '__none__' ? '' : level} />

                        <div>
                            <ZoruLabel htmlFor="desig-name" className="text-[13px] text-zoru-ink">
                                Designation Name <span className="text-red-500">*</span>
                            </ZoruLabel>
                            <ZoruInput
                                id="desig-name"
                                name="name"
                                required
                                defaultValue={editing?.name ?? ''}
                                placeholder="e.g. Senior Software Engineer"
                                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>

                        <div>
                            <ZoruLabel htmlFor="desig-desc" className="text-[13px] text-zoru-ink">
                                Description
                            </ZoruLabel>
                            <ZoruTextarea
                                id="desig-desc"
                                name="description"
                                rows={2}
                                defaultValue={editing?.description ?? ''}
                                placeholder="Optional description"
                                className="mt-1.5 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>

                        <div>
                            <ZoruLabel htmlFor="desig-dept" className="text-[13px] text-zoru-ink">
                                Department
                            </ZoruLabel>
                            <ZoruSelect value={deptId} onValueChange={setDeptId}>
                                <ZoruSelectTrigger
                                    id="desig-dept"
                                    className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                >
                                    <ZoruSelectValue placeholder="— No department —" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="__none__">— No department —</ZoruSelectItem>
                                    {departments.map((d) => (
                                        <ZoruSelectItem key={d._id.toString()} value={d._id.toString()}>
                                            {d.name}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>

                        <div>
                            <ZoruLabel htmlFor="desig-level" className="text-[13px] text-zoru-ink">
                                Level / Grade
                            </ZoruLabel>
                            <ZoruSelect value={level} onValueChange={setLevel}>
                                <ZoruSelectTrigger
                                    id="desig-level"
                                    className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                >
                                    <ZoruSelectValue placeholder="— No level —" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="__none__">— No level —</ZoruSelectItem>
                                    {GRADE_OPTIONS.map((g) => (
                                        <ZoruSelectItem key={g} value={g}>{g}</ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>

                        <ZoruDialogFooter>
                            <ZoruButton
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                            >
                                <X className="h-3.5 w-3.5" />
                                Cancel
                            </ZoruButton>
                            <SaveButton label={editing ? 'Save Changes' : 'Add Designation'} />
                        </ZoruDialogFooter>
                    </form>
                </ZoruDialogContent>
            </ZoruDialog>
        </EntityListShell>
    );
}
