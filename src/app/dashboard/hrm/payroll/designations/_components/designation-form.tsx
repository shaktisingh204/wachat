'use client';

import { Button, Card, ColorPicker, Input, Label, Switch, Textarea, useToast } from '@/components/sabcrm/20ui';
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
import { saveDesignationAction } from '@/app/actions/crm/departments.actions';
import type { CrmDesignationDoc } from '@/lib/rust-client/crm-departments';

interface Props {
  initial?: CrmDesignationDoc | null;
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create designation'}
    </Button>
  );
}

export function DesignationForm({ initial }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveDesignationAction, INITIAL_STATE);
  const editing = !!initial?._id;

  const [active, setActive] = React.useState<boolean>(initial?.active !== false);
  const [color, setColor] = React.useState<string>(initial?.color ?? '#6366F1');

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/hrm/payroll/designations');
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
            <Input id="name" name="name" required defaultValue={initial?.name ?? ''} className="mt-1.5" placeholder="Senior Engineer" />
          </div>
          <div>
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" defaultValue={initial?.code ?? ''} className="mt-1.5" placeholder="SE-2" />
          </div>
          <div>
            <Label>Department</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="department"
                name="departmentId"
                initialId={initial?.departmentId ?? null}
              />
            </div>
          </div>
          <div>
            <Label>Reports to (designation)</Label>
            <div className="mt-1.5">
              <EntityFormField
                entity="designation"
                name="reportsToDesignationId"
                initialId={initial?.reportsToDesignationId ?? null}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="level">Level</Label>
            <Input
              id="level"
              name="level"
              type="number"
              min={0}
              max={20}
              defaultValue={initial?.level ?? ''}
              className="mt-1.5"
              placeholder="1 = junior, 5 = principal"
            />
          </div>
          <div>
            <Label htmlFor="grade">Grade</Label>
            <Input id="grade" name="grade" defaultValue={initial?.grade ?? ''} className="mt-1.5" placeholder="L4 / Band B" />
          </div>
          <div>
            <Label htmlFor="minCtc">Min CTC (annual)</Label>
            <Input
              id="minCtc"
              name="minCtc"
              type="number"
              min={0}
              step="1000"
              defaultValue={initial?.minCtc ?? ''}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="maxCtc">Max CTC (annual)</Label>
            <Input
              id="maxCtc"
              name="maxCtc"
              type="number"
              min={0}
              step="1000"
              defaultValue={initial?.maxCtc ?? ''}
              className="mt-1.5"
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
              <div className="text-[12px] text-[var(--st-text-secondary)]">Inactive designations are hidden from new hires.</div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} aria-label="Active" />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/dashboard/hrm/payroll/designations">Cancel</Link>
        </Button>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
