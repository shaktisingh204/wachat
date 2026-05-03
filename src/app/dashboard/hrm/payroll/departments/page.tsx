'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Trash2, Building, Pencil, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    getCrmDepartments,
    saveCrmDepartment,
    deleteCrmDepartment,
    getCrmEmployees,
} from '@/app/actions/crm-employees.actions';
import type { WithId, CrmDepartment } from '@/lib/definitions';
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

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<WithId<CrmDepartment>[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(saveCrmDepartment, saveInitialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    // Dialog state for add/edit
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<WithId<CrmDepartment> | null>(null);

    // Controlled select values in dialog (useActionState + Select needs controlled state)
    const [parentId, setParentId] = useState('__none__');
    const [managerId, setManagerId] = useState('__none__');

    const fetchData = useCallback(() => {
        startLoading(async () => {
            const [depts, emps] = await Promise.all([
                getCrmDepartments(),
                getCrmEmployees(),
            ]);
            setDepartments(depts);
            setEmployees(emps);
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
            setParentId('__none__');
            setManagerId('__none__');
        }
        if (saveState.error) {
            toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
        }
    }, [saveState, toast, fetchData]);

    const [deleteTransition, startDeleteTransition] = useTransition();

    const handleDelete = (dept: WithId<CrmDepartment>) => {
        startDeleteTransition(async () => {
            const result = await deleteCrmDepartment(dept._id.toString());
            if (result.success) {
                toast({ title: 'Deleted', description: `"${dept.name}" removed.` });
                fetchData();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    const openAdd = () => {
        setEditing(null);
        setParentId('__none__');
        setManagerId('__none__');
        setDialogOpen(true);
    };

    const openEdit = (dept: WithId<CrmDepartment>) => {
        setEditing(dept);
        setParentId((dept as any).parent_department_id ?? '__none__');
        setManagerId((dept as any).manager_id ?? '__none__');
        setDialogOpen(true);
    };

    // Build employee count per department
    const empCountByDept = employees.reduce<Record<string, number>>((acc, e) => {
        if (e.departmentId) {
            const key = e.departmentId.toString();
            acc[key] = (acc[key] ?? 0) + 1;
        }
        return acc;
    }, {});

    // Parent dept name lookup
    const deptNameById = departments.reduce<Record<string, string>>((acc, d) => {
        acc[d._id.toString()] = d.name;
        return acc;
    }, {});

    // Manager name lookup
    const managerNameById = employees.reduce<Record<string, string>>((acc, e) => {
        acc[e._id.toString()] = `${e.firstName} ${e.lastName}`;
        return acc;
    }, {});

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Departments"
                subtitle="Organize your team into departments with parent structure and managers."
                icon={Building}
                actions={
                    <ClayButton
                        variant="obsidian"
                        leading={<Plus className="h-4 w-4" />}
                        onClick={openAdd}
                    >
                        Add Department
                    </ClayButton>
                }
            />

            <ClayCard>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[16px] font-semibold text-foreground">All Departments</h2>
                    <ClayBadge tone="neutral">{departments.length} total</ClayBadge>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-border bg-secondary">
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Department</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Parent Dept.</th>
                                <th className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Manager</th>
                                <th className="px-4 py-3 text-center text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Employees</th>
                                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </td>
                                </tr>
                            ) : departments.length > 0 ? (
                                departments.map((dept) => {
                                    const parentName = (dept as any).parent_department_id
                                        ? deptNameById[(dept as any).parent_department_id] ?? '—'
                                        : '—';
                                    const managerName = (dept as any).manager_id
                                        ? managerNameById[(dept as any).manager_id] ?? '—'
                                        : '—';
                                    const count = empCountByDept[dept._id.toString()] ?? 0;
                                    return (
                                        <tr key={dept._id.toString()} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-foreground">{dept.name}</div>
                                                {dept.description ? (
                                                    <div className="text-[11.5px] text-muted-foreground">{dept.description}</div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{parentName}</td>
                                            <td className="px-4 py-3 text-foreground">{managerName}</td>
                                            <td className="px-4 py-3 text-center">
                                                <ClayBadge tone="neutral">{count}</ClayBadge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <ClayButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEdit(dept)}
                                                        aria-label="Edit"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </ClayButton>
                                                    <ClayButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(dept)}
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
                                    <td colSpan={5} className="h-24 text-center text-[13px] text-muted-foreground">
                                        No departments yet. Click "Add Department" to create one.
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
                            {editing ? 'Edit Department' : 'Add Department'}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Fill in the department details. Only the name is required.
                        </DialogDescription>
                    </DialogHeader>
                    <form action={formAction} ref={formRef} className="space-y-4">
                        {editing?._id ? (
                            <input type="hidden" name="_id" value={editing._id.toString()} />
                        ) : null}

                        {/* Hidden fields for controlled selects */}
                        <input type="hidden" name="parent_department_id" value={parentId === '__none__' ? '' : parentId} />
                        <input type="hidden" name="manager_id" value={managerId === '__none__' ? '' : managerId} />

                        <div>
                            <Label htmlFor="dept-name" className="text-[13px] text-foreground">
                                Department Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="dept-name"
                                name="name"
                                required
                                defaultValue={editing?.name ?? ''}
                                placeholder="e.g. Engineering"
                                className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                            />
                        </div>

                        <div>
                            <Label htmlFor="dept-desc" className="text-[13px] text-foreground">
                                Description
                            </Label>
                            <Textarea
                                id="dept-desc"
                                name="description"
                                rows={2}
                                defaultValue={editing?.description ?? ''}
                                placeholder="Optional description"
                                className="mt-1.5 rounded-lg border-border bg-card text-[13px]"
                            />
                        </div>

                        <div>
                            <Label htmlFor="dept-parent" className="text-[13px] text-foreground">
                                Parent Department
                            </Label>
                            <Select value={parentId} onValueChange={setParentId}>
                                <SelectTrigger
                                    id="dept-parent"
                                    className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                                >
                                    <SelectValue placeholder="— Root (no parent) —" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">— Root (no parent) —</SelectItem>
                                    {departments
                                        .filter((d) => d._id.toString() !== editing?._id.toString())
                                        .map((d) => (
                                            <SelectItem key={d._id.toString()} value={d._id.toString()}>
                                                {d.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="dept-manager" className="text-[13px] text-foreground">
                                Manager
                            </Label>
                            <Select value={managerId} onValueChange={setManagerId}>
                                <SelectTrigger
                                    id="dept-manager"
                                    className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
                                >
                                    <SelectValue placeholder="— No manager assigned —" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">— No manager assigned —</SelectItem>
                                    {employees.map((e) => (
                                        <SelectItem key={e._id.toString()} value={e._id.toString()}>
                                            {e.firstName} {e.lastName}
                                            {e.designationName ? ` · ${e.designationName}` : ''}
                                        </SelectItem>
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
                            <SaveButton label={editing ? 'Save Changes' : 'Add Department'} />
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
