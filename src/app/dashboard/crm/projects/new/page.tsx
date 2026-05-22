'use client';

import {
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import { useActionState } from 'react';

/**
 * New Project — form page (rebuilt per §1D.3).
 *
 * Uses <EntityFormShell> with sectioned cards; every reference field is an
 * <EntityFormField>. FormData keys preserved from the legacy save action
 * (`saveWsProject`): name, clientId, projectAdmin, categoryId, subCategoryId,
 * departmentId, status, priority, completionPercent, projectBudget, currency,
 * hoursAllocated, startDate, deadline, projectShortCode, description, notes,
 * billable, public.
 */

import * as React from 'react';

import { EntityFormShell } from '@/components/crm/entity-form-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { saveWsProject } from '@/app/actions/worksuite/projects.actions';

interface ProjectFormProps {
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

export default function NewProjectPage() {
  return <ProjectForm />;
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
                <Label htmlFor="name">
                  Project name <span className="text-zoru-danger-ink">*</span>
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
                <Label htmlFor="status">
                  Status <span className="text-zoru-danger-ink">*</span>
                </Label>
                <Select
                  name="status"
                  defaultValue={initial?.status ?? 'not started'}
                >
                  <ZoruSelectTrigger id="status">
                    <ZoruSelectValue placeholder="Status" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="not started">Not Started</ZoruSelectItem>
                    <ZoruSelectItem value="in progress">In Progress</ZoruSelectItem>
                    <ZoruSelectItem value="on hold">On Hold</ZoruSelectItem>
                    <ZoruSelectItem value="finished">Finished</ZoruSelectItem>
                    <ZoruSelectItem value="canceled">Canceled</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  name="priority"
                  defaultValue={initial?.priority ?? 'medium'}
                >
                  <ZoruSelectTrigger id="priority">
                    <ZoruSelectValue placeholder="Priority" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="low">Low</ZoruSelectItem>
                    <ZoruSelectItem value="medium">Medium</ZoruSelectItem>
                    <ZoruSelectItem value="high">High</ZoruSelectItem>
                    <ZoruSelectItem value="urgent">Urgent</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
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
