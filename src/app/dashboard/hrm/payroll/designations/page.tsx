'use client';

import { Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Card, Button, Badge, useToast } from '@/components/sabcrm/20ui';
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
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {label}
        </Button>
    );
}

export default function DesignationsPage() {
    const [designations, setDesignations] = useState<WithId<CrmDesignation>[]>([]);
    const [departments, setDepartments] = useState<WithId<CrmDepartment>[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(saveCrmDesignation, saveInitialState);
    const { toast } = useToast();
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
                <Button onClick={openAdd}>
                    <Plus className="h-4 w-4" />
                    Add Designation
                </Button>
            }
        >

            <Card className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[16px] text-[var(--st-text)]">All Designations</h2>
                    <Badge variant="secondary">{designations.length} total</Badge>
                </div>
                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">Designation</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">Department</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-[var(--st-text-secondary)]">Level / Grade</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-[var(--st-text-secondary)]">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                    </td>
                                </tr>
                            ) : designations.length > 0 ? (
                                designations.map((desig) => {
                                    const deptName = (desig as any).department_id
                                        ? deptNameById[(desig as any).department_id.toString()] ?? '—'
                                        : '—';
                                    return (
                                        <tr key={desig._id.toString()} className="border-b border-[var(--st-border)] last:border-0 hover:bg-[var(--st-bg-muted)]/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="text-[var(--st-text)]">{desig.name}</div>
                                                {desig.description ? (
                                                    <div className="text-[11.5px] text-[var(--st-text-secondary)]">{desig.description}</div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3 text-[var(--st-text-secondary)]">{deptName}</td>
                                            <td className="px-4 py-3">
                                                {(desig as any).level ? (
                                                    <Badge variant="info">{(desig as any).level}</Badge>
                                                ) : (
                                                    <span className="text-[var(--st-text-secondary)]">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEdit(desig)}
                                                        aria-label="Edit"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(desig)}
                                                        disabled={deleteTransition}
                                                        aria-label="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5 text-[var(--st-text)]" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]">
                                        No designations yet. Click &quot;Add Designation&quot; to create one.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-[var(--st-text)]">
                            {editing ? 'Edit Designation' : 'Add Designation'}
                        </DialogTitle>
                        <DialogDescription className="text-[var(--st-text-secondary)]">
                            Fill in the designation details. Only the name is required.
                        </DialogDescription>
                    </DialogHeader>
                    <form action={formAction} ref={formRef} className="space-y-4">
                        {editing?._id ? (
                            <input type="hidden" name="_id" value={editing._id.toString()} />
                        ) : null}

                        <input type="hidden" name="department_id" value={deptId === '__none__' ? '' : deptId} />
                        <input type="hidden" name="level" value={level === '__none__' ? '' : level} />

                        <div>
                            <Label htmlFor="desig-name" className="text-[13px] text-[var(--st-text)]">
                                Designation Name <span className="text-[var(--st-text)]">*</span>
                            </Label>
                            <Input
                                id="desig-name"
                                name="name"
                                required
                                defaultValue={editing?.name ?? ''}
                                placeholder="e.g. Senior Software Engineer"
                                className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                            />
                        </div>

                        <div>
                            <Label htmlFor="desig-desc" className="text-[13px] text-[var(--st-text)]">
                                Description
                            </Label>
                            <Textarea
                                id="desig-desc"
                                name="description"
                                rows={2}
                                defaultValue={editing?.description ?? ''}
                                placeholder="Optional description"
                                className="mt-1.5 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                            />
                        </div>

                        <div>
                            <Label htmlFor="desig-dept" className="text-[13px] text-[var(--st-text)]">
                                Department
                            </Label>
                            <Select value={deptId} onValueChange={setDeptId}>
                                <SelectTrigger
                                    id="desig-dept"
                                    className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
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
                            <Label htmlFor="desig-level" className="text-[13px] text-[var(--st-text)]">
                                Level / Grade
                            </Label>
                            <Select value={level} onValueChange={setLevel}>
                                <SelectTrigger
                                    id="desig-level"
                                    className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
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
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                            >
                                <X className="h-3.5 w-3.5" />
                                Cancel
                            </Button>
                            <SaveButton label={editing ? 'Save Changes' : 'Add Designation'} />
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </EntityListShell>
    );
}
