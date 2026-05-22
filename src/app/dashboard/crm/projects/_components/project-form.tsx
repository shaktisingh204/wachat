'use client';

import { Input, Label, Switch, Textarea, useZoruToast } from '@/components/zoruui';
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
    };
}

export function ProjectForm({ initial }: ProjectFormProps = {}) {
    const router = useRouter();
    const { toast } = useZoruToast();

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
                                <ZoruLabel htmlFor="name">
                                    Project name <span className="text-zoru-danger-ink">*</span>
                                </ZoruLabel>
                                <ZoruInput
                                    id="name"
                                    name="name"
                                    defaultValue={initial?.name ?? ''}
                                    placeholder="e.g. Acme website redesign"
                                    required
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="projectShortCode">Short code</ZoruLabel>
                                <ZoruInput
                                    id="projectShortCode"
                                    name="projectShortCode"
                                    defaultValue={initial?.projectShortCode ?? ''}
                                    placeholder="PRJ-001"
                                />
                            </div>
                            <div>
                                <ZoruLabel>Client</ZoruLabel>
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
                                <ZoruLabel>Manager (owner)</ZoruLabel>
                                <EntityFormField
                                    entity="user"
                                    name="projectAdmin"
                                    dualWriteName="managerName"
                                    initialId={initial?.projectAdmin}
                                    placeholder="Pick a manager"
                                />
                            </div>
                            <div>
                                <ZoruLabel>Category</ZoruLabel>
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
                                <ZoruLabel>Department</ZoruLabel>
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
                                <ZoruLabel htmlFor="startDate">Start date</ZoruLabel>
                                <ZoruInput
                                    id="startDate"
                                    name="startDate"
                                    type="date"
                                    defaultValue={initial?.startDate ?? ''}
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="deadline">Deadline</ZoruLabel>
                                <ZoruInput
                                    id="deadline"
                                    name="deadline"
                                    type="date"
                                    defaultValue={initial?.deadline ?? ''}
                                />
                            </div>
                            <div>
                                <ZoruLabel>
                                    Status <span className="text-zoru-danger-ink">*</span>
                                </ZoruLabel>
                                <EnumFormField
                                    enumName="projectStatus"
                                    name="status"
                                    initialId={initial?.status ?? 'not started'}
                                    placeholder="Status"
                                />
                            </div>
                            <div>
                                <ZoruLabel>Priority</ZoruLabel>
                                <EnumFormField
                                    enumName="priorityMedium"
                                    name="priority"
                                    initialId={initial?.priority ?? 'medium'}
                                    placeholder="Priority"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="completionPercent">% Complete</ZoruLabel>
                                <ZoruInput
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
                                <ZoruLabel htmlFor="projectBudget">Project budget</ZoruLabel>
                                <ZoruInput
                                    id="projectBudget"
                                    name="projectBudget"
                                    type="number"
                                    step="0.01"
                                    defaultValue={String(initial?.projectBudget ?? '')}
                                />
                            </div>
                            <div>
                                <ZoruLabel>Currency</ZoruLabel>
                                <EntityFormField
                                    entity="currency"
                                    name="currency"
                                    initialId={initial?.currency}
                                    placeholder="INR"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="hoursAllocated">Hours allocated</ZoruLabel>
                                <ZoruInput
                                    id="hoursAllocated"
                                    name="hoursAllocated"
                                    type="number"
                                    step="0.5"
                                    defaultValue={String(initial?.hoursAllocated ?? '')}
                                />
                            </div>
                            <div className="flex items-center gap-3 pt-6">
                                <ZoruSwitch
                                    id="billable"
                                    name="billable"
                                    defaultChecked={!!initial?.billable}
                                />
                                <ZoruLabel htmlFor="billable">Billable project</ZoruLabel>
                            </div>
                            <div className="flex items-center gap-3">
                                <ZoruSwitch
                                    id="public"
                                    name="public"
                                    defaultChecked={!!initial?.public}
                                />
                                <ZoruLabel htmlFor="public">Public (client portal)</ZoruLabel>
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
                                <ZoruLabel htmlFor="description">Description</ZoruLabel>
                                <ZoruTextarea
                                    id="description"
                                    name="description"
                                    defaultValue={initial?.description ?? ''}
                                    rows={4}
                                    placeholder="Scope, goals, success criteria…"
                                />
                            </div>
                            <div>
                                <ZoruLabel htmlFor="notes">Internal notes</ZoruLabel>
                                <ZoruTextarea
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
