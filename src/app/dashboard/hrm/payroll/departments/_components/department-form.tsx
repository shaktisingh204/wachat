'use client';

import { Button, Card, ColorPicker, Input, Label, Switch, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { saveDepartmentAction } from '@/app/actions/crm/departments.actions';
import type { CrmDepartmentDoc } from '@/lib/rust-client/crm-departments';

interface Props {
  initial?: CrmDepartmentDoc | null;
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create department'}
    </Button>
  );
}

export function DepartmentForm({ initial }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveDepartmentAction, INITIAL_STATE);
  const editing = !!initial?._id;

  const [active, setActive] = React.useState<boolean>(initial?.active !== false);
  const [color, setColor] = React.useState<string>(initial?.color ?? '#F59E0B');

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/hrm/payroll/departments');
    }
    if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
  }, [state, toast, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? <input type="hidden" name="_id" value={String(initial!._id)} /> : null}
      <input type="hidden" name="active" value={String(active)} />

      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="name">
              Name <span className="text-[var(--st-danger)]">*</span>
            </Label>
            <Input id="name" name="name" required defaultValue={initial?.name ?? ''} className="mt-1.5" placeholder="Engineering" />
          </div>
          <div>
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" defaultValue={initial?.code ?? ''} className="mt-1.5" placeholder="ENG" />
          </div>
          <div>
            <Label>Parent department</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="department"
                name="parentDepartmentId"
                initialId={initial?.parentDepartmentId ?? null}
                placeholder="Top-level if empty"
              />
            </div>
          </div>
          <div>
            <Label>Head (employee)</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="employee"
                name="headId"
                initialId={initial?.headId ?? null}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="costCenter">Cost center</Label>
            <Input
              id="costCenter"
              name="costCenter"
              defaultValue={initial?.costCenter ?? ''}
              className="mt-1.5"
              placeholder="e.g. CC-ENG-01"
            />
          </div>
          <div>
            <Label>Color</Label>
            <input type="hidden" name="color" value={color} />
            <div className="mt-1.5">
              <ColorPicker value={color} onChange={setColor} />
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={initial?.description ?? ''}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3">
            <div className="flex-1">
              <div className="text-[13px] text-[var(--st-text)]">Active</div>
              <div className="text-[12px] text-[var(--st-text-secondary)]">
                Inactive departments are hidden from new employee selectors.
              </div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} aria-label="Active" />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/dashboard/hrm/payroll/departments">Cancel</Link>
        </Button>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
