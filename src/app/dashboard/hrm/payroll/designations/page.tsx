'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Trash2, BadgeCheck, Pencil, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    getCrmDesignations,
    saveCrmDesignation,
    deleteCrmDesignation,
    getCrmDepartments,
} from '@/app/actions/crm-employees.actions';
import type { WithId, CrmDesignation, CrmDepartment } from '@/lib/definitions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const saveInitialState: any = { message: null, error: null };

const GRADE_OPTIONS = [
    'L1 — Junior', 'L2 — Mid', 'L3 — Senior', 'L4 — Lead',
    'L5 — Principal', 'L6 — Staff', 'L7 — Director', 'L8 — VP', 'L9 — C-Level',
];

function SaveButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <ClayButton
            type="submit"
            variant="obsidian"
            disabled={pending}
            leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
        >
            {label}
        </ClayButton>
    );
}

export default function DesignationsPage() {
    const [designations, setDesignations] = useState<WithId<CrmDesignation>[]>([]);
    const [departments, setDepartments] = useState<WithId<CrmDepartment>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(saveCrmDesignation, saveInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    // Dialog state
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

    // Build dept name lookup
    const deptNameById = departments.reduce<Record<string, string>>((acc, d) => {
        acc[d._id.toString()] = d.name;
        return acc;
    }, {});

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Designations"
                subtitle="Manage job titles with department mapping and grade levels."
                icon={BadgeCheck}
                actions={
                    <ClayButton
                        variant="obsidian"
                        leading={<Plus className="h-4 w-4" />}
                        onClick={openAdd}
                    >
                        Add Designation
                    </ClayButton>
                }
            />

            <ClayCard>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[16px] font-semibold text-foreground">All Designations</h2>
                    <ClayBadge tone="neutral">{designations.length} total</ClayBadge>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-border bg-secondary">
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Designation</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Department</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Level / Grade</th>
                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </td>
                                </tr>
                            ) : designations.length > 0 ? (
                                designations.map((desig) => {
                                    const deptName = (desig as any).department_id
                                        ? deptNameById[(desig as any).department_id.toString()] ?? '—'
                                        : '—';
                                    return (
                                        <tr key={desig._id.toString()} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-foreground">{desig.name}</div>
                                                {desig.description ? (
                                                    <div className="text-[11.5px] text-muted-foreground">{desig.description}</div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{deptName}</td>
                                            <td className="px-4 py-3">
                                                {(desig as any).level ? (
                                                    <ClayBadge tone="blue">{(desig as any).level}</ClayBadge>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <ClayButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEdit(desig)}
                                                        aria-label="Edit"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </ClayButton>
                                                    <ClayButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(desig)}
                                                        disabled={deleteTransition}
                                                        aria-label="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                                    </ClayButton>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="h-24 text-center text-[13px] text-muted-foreground">
                                        No designations yet. Click "Add Designation" to create one.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </ClayCard>

            {/* Add / Edit dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-foreground">
                            {editing ? 'Edit Designation' : 'Add Designation'}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Fill in the designation details. Only the name is required.
                        </DialogDescription>
                    </DialogHeader>
                    <form action={formAction} ref={formRef} className="space-y-4">
                        {editing?._id ? (
                            <input type="hidden" name="_id" value={editing._id.toString()} />
                        ) : null}

                        {/* Hidden fields for controlled selects */}
                        <input type="hidden" name="department_id" value={deptId === '__none__' ? '' : deptId} />
                        <input type="hidden" name="level" value={level === '__none__' ? '' : level} />

                        <div>
                            <Label htmlFor="desig-name" className="text-[13px] text-foreground">
                                Designation Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="desig-name"
                                name="name"
                                required
                                defaultValue={editing?.name ?? ''}
                                placeholder="e.g. Senior Software Engineer"
                                className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                            />
                        </div>

                        <div>
                            <Label htmlFor="desig-desc" className="text-[13px] text-foreground">
                                Description
                            </Label>
                            <Textarea
                                id="desig-desc"
                                name="description"
                                rows={2}
                                defaultValue={editing?.description ?? ''}
                                placeholder="Optional description"
                                className="mt-1.5 rounded-lg border-border bg-card text-[13px]"
                            />
                        </div>

                        <div>
                            <Label htmlFor="desig-dept" className="text-[13px] text-foreground">
                                Department
                            </Label>
                            <Select value={deptId} onValueChange={setDeptId}>
                                <SelectTrigger
                                    id="desig-dept"
                                    className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                                >
                                    <SelectValue placeholder="— No department —" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">— No department —</SelectItem>
                                    {departments.map((d) => (
                                        <SelectItem key={d._id.toString()} value={d._id.toString()}>
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="desig-level" className="text-[13px] text-foreground">
                                Level / Grade
                            </Label>
                            <Select value={level} onValueChange={setLevel}>
                                <SelectTrigger
                                    id="desig-level"
                                    className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                                >
                                    <SelectValue placeholder="— No level —" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">— No level —</SelectItem>
                                    {GRADE_OPTIONS.map((g) => (
                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <DialogFooter>
                            <ClayButton
                                type="button"
                                variant="pill"
                                onClick={() => setDialogOpen(false)}
                                leading={<X className="h-3.5 w-3.5" />}
                            >
                                Cancel
                            </ClayButton>
                            <SaveButton label={editing ? 'Save Changes' : 'Add Designation'} />
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
