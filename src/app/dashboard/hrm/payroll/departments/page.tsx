'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Trash2, Building, Pencil, Plus, X } from 'lucide-react';
import {
    ZoruInput,
    ZoruLabel,
    ZoruTextarea,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruCard,
    ZoruButton,
    ZoruBadge,
    useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import {
    getCrmDepartments,
    saveCrmDepartment,
    deleteCrmDepartment,
    getCrmEmployees,
} from '@/app/actions/crm-employees.actions';
import type { WithId, CrmDepartment } from '@/lib/definitions';

const saveInitialState: any = { message: null, error: null };

function SaveButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {label}
        </ZoruButton>
    );
}

export default function DepartmentsPage() {
    const [departments, setDepartments] = useState<WithId<CrmDepartment>[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [saveState, formAction] = useActionState(saveCrmDepartment, saveInitialState);
    const { toast } = useZoruToast();
    const formRef = useRef<HTMLFormElement>(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<WithId<CrmDepartment> | null>(null);

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

    const empCountByDept = employees.reduce<Record<string, number>>((acc, e) => {
        if (e.departmentId) {
            const key = e.departmentId.toString();
            acc[key] = (acc[key] ?? 0) + 1;
        }
        return acc;
    }, {});

    const deptNameById = departments.reduce<Record<string, string>>((acc, d) => {
        acc[d._id.toString()] = d.name;
        return acc;
    }, {});

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
                    <ZoruButton onClick={openAdd}>
                        <Plus className="h-4 w-4" />
                        Add Department
                    </ZoruButton>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[16px] text-zoru-ink">All Departments</h2>
                    <ZoruBadge variant="secondary">{departments.length} total</ZoruBadge>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <table className="w-full text-left text-[13px]">
                        <thead>
                            <tr className="border-b border-zoru-line bg-zoru-surface-2">
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Department</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Parent Dept.</th>
                                <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">Manager</th>
                                <th className="px-4 py-3 text-center text-[12px] uppercase text-zoru-ink-muted">Employees</th>
                                <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
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
                                        <tr key={dept._id.toString()} className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="text-zoru-ink">{dept.name}</div>
                                                {dept.description ? (
                                                    <div className="text-[11.5px] text-zoru-ink-muted">{dept.description}</div>
                                                ) : null}
                                            </td>
                                            <td className="px-4 py-3 text-zoru-ink-muted">{parentName}</td>
                                            <td className="px-4 py-3 text-zoru-ink">{managerName}</td>
                                            <td className="px-4 py-3 text-center">
                                                <ZoruBadge variant="secondary">{count}</ZoruBadge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => openEdit(dept)}
                                                        aria-label="Edit"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </ZoruButton>
                                                    <ZoruButton
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(dept)}
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
                                    <td colSpan={5} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                        No departments yet. Click &quot;Add Department&quot; to create one.
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
                            {editing ? 'Edit Department' : 'Add Department'}
                        </ZoruDialogTitle>
                        <ZoruDialogDescription className="text-zoru-ink-muted">
                            Fill in the department details. Only the name is required.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <form action={formAction} ref={formRef} className="space-y-4">
                        {editing?._id ? (
                            <input type="hidden" name="_id" value={editing._id.toString()} />
                        ) : null}

                        <input type="hidden" name="parent_department_id" value={parentId === '__none__' ? '' : parentId} />
                        <input type="hidden" name="manager_id" value={managerId === '__none__' ? '' : managerId} />

                        <div>
                            <ZoruLabel htmlFor="dept-name" className="text-[13px] text-zoru-ink">
                                Department Name <span className="text-red-500">*</span>
                            </ZoruLabel>
                            <ZoruInput
                                id="dept-name"
                                name="name"
                                required
                                defaultValue={editing?.name ?? ''}
                                placeholder="e.g. Engineering"
                                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>

                        <div>
                            <ZoruLabel htmlFor="dept-desc" className="text-[13px] text-zoru-ink">
                                Description
                            </ZoruLabel>
                            <ZoruTextarea
                                id="dept-desc"
                                name="description"
                                rows={2}
                                defaultValue={editing?.description ?? ''}
                                placeholder="Optional description"
                                className="mt-1.5 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                            />
                        </div>

                        <div>
                            <ZoruLabel htmlFor="dept-parent" className="text-[13px] text-zoru-ink">
                                Parent Department
                            </ZoruLabel>
                            <ZoruSelect value={parentId} onValueChange={setParentId}>
                                <ZoruSelectTrigger
                                    id="dept-parent"
                                    className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                >
                                    <ZoruSelectValue placeholder="— Root (no parent) —" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="__none__">— Root (no parent) —</ZoruSelectItem>
                                    {departments
                                        .filter((d) => d._id.toString() !== editing?._id.toString())
                                        .map((d) => (
                                            <ZoruSelectItem key={d._id.toString()} value={d._id.toString()}>
                                                {d.name}
                                            </ZoruSelectItem>
                                        ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>

                        <div>
                            <ZoruLabel htmlFor="dept-manager" className="text-[13px] text-zoru-ink">
                                Manager
                            </ZoruLabel>
                            <ZoruSelect value={managerId} onValueChange={setManagerId}>
                                <ZoruSelectTrigger
                                    id="dept-manager"
                                    className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                                >
                                    <ZoruSelectValue placeholder="— No manager assigned —" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="__none__">— No manager assigned —</ZoruSelectItem>
                                    {employees.map((e) => (
                                        <ZoruSelectItem key={e._id.toString()} value={e._id.toString()}>
                                            {e.firstName} {e.lastName}
                                            {e.designationName ? ` · ${e.designationName}` : ''}
                                        </ZoruSelectItem>
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
                            <SaveButton label={editing ? 'Save Changes' : 'Add Department'} />
                        </ZoruDialogFooter>
                    </form>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}
