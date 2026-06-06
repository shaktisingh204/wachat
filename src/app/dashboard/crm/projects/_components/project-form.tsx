'use client';

import { Input, Label, Switch, Textarea, useToast, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { useActionState } from 'react';

/**
 * Shared <ProjectForm> — used by /projects/new and /projects/[projectId]/edit
 * (§1B W7). Extracted from new/page.tsx so both surfaces can re-use it
 * without route-module cross-imports.
 *
 * Preserves FormData keys consumed by `saveWsProject`: name, clientId,
 * projectAdmin, categoryId, subCategoryId, departmentId, status, priority,
 * completionPercent, projectBudget, currency, hoursAllocated, startDate,
 * deadline, projectShortCode, description, notes, billable, public.
 */

import * as React from 'react';

import { EntityFormShell } from '@/components/crm/entity-form-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { saveWsProject } from '@/app/actions/worksuite/projects.actions';

export interface ProjectFormProps {
    initial?: {
        _id?: string;
        name?: string;
        clientId?: string;
        projectAdmin?: string;
        categoryId?: string;
        subCategoryId?: string;
        departmentId?: string;
        status?: string;
        priority?: string;
        completionPercent?: number;
        projectBudget?: number;
        currency?: string;
        hoursAllocated?: number;
        startDate?: string;
        deadline?: string;
        projectShortCode?: string;
        description?: string;
        notes?: string;
        billable?: number;
        public?: number;
        visibilityType?: 'all' | 'assigned';
    };
}

export function ProjectForm({ initial }: ProjectFormProps = {}) {
    const router = useRouter();
    const { toast } = useToast();

    const [state, formAction] = useActionState(
        async (
            _prev: { message?: string; error?: string; id?: string } | null,
            formData: FormData,
        ) => {
            const res = await saveWsProject(_prev, formData);
            if (res.error) {
                toast({
                    title: 'Save failed',
                    description: res.error,
                    variant: 'destructive',
                });
                return res;
            }
            toast({ title: initial?._id ? 'Project updated' : 'Project created' });
            if (res.id) router.push(`/dashboard/crm/projects/${res.id}`);
            else router.push('/dashboard/crm/projects');
            return res;
        },
        null,
    );

    return (
        <EntityFormShell
            title={initial?._id ? 'Edit project' : 'New project'}
            subtitle="Track delivery against a client engagement — tasks, milestones, time, and budget."
            action={formAction}
            submitLabel={initial?._id ? 'Save changes' : 'Create project'}
            cancelHref="/dashboard/crm/projects"
            error={state?.error}
            message={state?.message}
            hiddenInputs={
                initial?._id ? (
                    <input type="hidden" name="_id" defaultValue={initial._id} />
                ) : null
            }
            sections={[
                {
                    id: 'basic',
                    title: 'Basic info',
                    description: 'Name, code, and who the project is for.',
                    children: (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <Label htmlFor="name">
                                    Project name <span className="text-[var(--st-danger)]">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={initial?.name ?? ''}
                                    placeholder="e.g. Acme website redesign"
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="projectShortCode">Short code</Label>
                                <Input
                                    id="projectShortCode"
                                    name="projectShortCode"
                                    defaultValue={initial?.projectShortCode ?? ''}
                                    placeholder="PRJ-001"
                                />
                            </div>
                            <div>
                                <Label>Client</Label>
                                <EntityFormField
                                    entity="client"
                                    name="clientId"
                                    dualWriteName="clientName"
                                    initialId={initial?.clientId}
                                    placeholder="Pick a client"
                                    allowCreate
                                />
                            </div>
                            <div>
                                <Label>Manager (owner)</Label>
                                <EntityFormField
                                    entity="user"
                                    name="projectAdmin"
                                    dualWriteName="managerName"
                                    initialId={initial?.projectAdmin}
                                    placeholder="Pick a manager"
                                />
                            </div>
                            <div>
                                <Label>Category</Label>
                                <EntityFormField
                                    entity="category"
                                    name="categoryId"
                                    dualWriteName="categoryName"
                                    initialId={initial?.categoryId}
                                    placeholder="Pick a category"
                                    allowCreate
                                />
                            </div>
                            <div>
                                <Label>Department</Label>
                                <EntityFormField
                                    entity="department"
                                    name="departmentId"
                                    dualWriteName="departmentName"
                                    initialId={initial?.departmentId}
                                    placeholder="Pick a department"
                                    allowCreate
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'timeline',
                    title: 'Timeline & status',
                    description: 'Dates, status, priority, and progress.',
                    children: (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <Label htmlFor="startDate">Start date</Label>
                                <Input
                                    id="startDate"
                                    name="startDate"
                                    type="date"
                                    defaultValue={initial?.startDate ?? ''}
                                />
                            </div>
                            <div>
                                <Label htmlFor="deadline">Deadline</Label>
                                <Input
                                    id="deadline"
                                    name="deadline"
                                    type="date"
                                    defaultValue={initial?.deadline ?? ''}
                                />
                            </div>
                            <div>
                                <Label>
                                    Status <span className="text-[var(--st-danger)]">*</span>
                                </Label>
                                <EnumFormField
                                    enumName="projectStatus"
                                    name="status"
                                    initialId={initial?.status ?? 'not started'}
                                    placeholder="Status"
                                />
                            </div>
                            <div>
                                <Label>Priority</Label>
                                <EnumFormField
                                    enumName="priorityMedium"
                                    name="priority"
                                    initialId={initial?.priority ?? 'medium'}
                                    placeholder="Priority"
                                />
                            </div>
                            <div>
                                <Label htmlFor="completionPercent">% Complete</Label>
                                <Input
                                    id="completionPercent"
                                    name="completionPercent"
                                    type="number"
                                    min={0}
                                    max={100}
                                    defaultValue={String(initial?.completionPercent ?? 0)}
                                />
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'budget',
                    title: 'Budget & hours',
                    description: 'Money and billable allocation.',
                    children: (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <Label htmlFor="projectBudget">Project budget</Label>
                                <Input
                                    id="projectBudget"
                                    name="projectBudget"
                                    type="number"
                                    step="0.01"
                                    defaultValue={String(initial?.projectBudget ?? '')}
                                />
                            </div>
                            <div>
                                <Label>Currency</Label>
                                <EntityFormField
                                    entity="currency"
                                    name="currency"
                                    initialId={initial?.currency}
                                    placeholder="INR"
                                />
                            </div>
                            <div>
                                <Label htmlFor="hoursAllocated">Hours allocated</Label>
                                <Input
                                    id="hoursAllocated"
                                    name="hoursAllocated"
                                    type="number"
                                    step="0.5"
                                    defaultValue={String(initial?.hoursAllocated ?? '')}
                                />
                            </div>
                            <div className="flex items-center gap-3 pt-6">
                                <Switch
                                    id="billable"
                                    name="billable"
                                    defaultChecked={!!initial?.billable}
                                />
                                <Label htmlFor="billable">Billable project</Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="public"
                                    name="public"
                                    defaultChecked={!!initial?.public}
                                />
                                <Label htmlFor="public">Public (client portal)</Label>
                            </div>
                            <div className="md:col-span-2">
                                <Label>Project Visibility</Label>
                                <Select name="visibilityType" defaultValue={initial?.visibilityType ?? 'assigned'}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select visibility" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Visible to all employees</SelectItem>
                                        <SelectItem value="assigned">Only assigned team members</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-[11px] text-[var(--st-text-secondary)] mt-1">
                                    Admins will always see all projects. This setting controls visibility for regular employees.
                                </p>
                            </div>
                        </div>
                    ),
                },
                {
                    id: 'notes',
                    title: 'Description & notes',
                    children: (
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    defaultValue={initial?.description ?? ''}
                                    rows={4}
                                    placeholder="Scope, goals, success criteria…"
                                />
                            </div>
                            <div>
                                <Label htmlFor="notes">Internal notes</Label>
                                <Textarea
                                    id="notes"
                                    name="notes"
                                    defaultValue={initial?.notes ?? ''}
                                    rows={3}
                                    placeholder="Notes only the team will see…"
                                />
                            </div>
                        </div>
                    ),
                },
            ]}
        />
    );
}

export default ProjectForm;
