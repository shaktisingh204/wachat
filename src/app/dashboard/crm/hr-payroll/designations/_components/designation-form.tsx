'use client';

import { ZoruButton, ZoruCard, ZoruColorPicker, ZoruInput, ZoruLabel, ZoruSwitch, ZoruTextarea, useZoruToast } from '@/components/zoruui';
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
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create designation'}
    </ZoruButton>
  );
}

export function DesignationForm({ initial }: Props) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveDesignationAction, INITIAL_STATE);
  const editing = !!initial?._id;

  const [active, setActive] = React.useState<boolean>(initial?.active !== false);
  const [color, setColor] = React.useState<string>(initial?.color ?? '#6366F1');

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/crm/hr-payroll/designations');
    }
    if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
  }, [state, toast, router]);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing ? <input type="hidden" name="_id" value={String(initial!._id)} /> : null}
      <input type="hidden" name="active" value={String(active)} />

      <ZoruCard className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="name">
              Name <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput id="name" name="name" required defaultValue={initial?.name ?? ''} className="mt-1.5" placeholder="Senior Engineer" />
          </div>
          <div>
            <ZoruLabel htmlFor="code">Code</ZoruLabel>
            <ZoruInput id="code" name="code" defaultValue={initial?.code ?? ''} className="mt-1.5" placeholder="SE-2" />
          </div>
          <div>
            <ZoruLabel>Department</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="department"
                name="departmentId"
                initialId={initial?.departmentId ?? null}
              />
            </div>
          </div>
          <div>
            <ZoruLabel>Reports to (designation)</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="designation"
                name="reportsToDesignationId"
                initialId={initial?.reportsToDesignationId ?? null}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="level">Level</ZoruLabel>
            <ZoruInput
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
            <ZoruLabel htmlFor="grade">Grade</ZoruLabel>
            <ZoruInput id="grade" name="grade" defaultValue={initial?.grade ?? ''} className="mt-1.5" placeholder="L4 / Band B" />
          </div>
          <div>
            <ZoruLabel htmlFor="minCtc">Min CTC (annual)</ZoruLabel>
            <ZoruInput
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
            <ZoruLabel htmlFor="maxCtc">Max CTC (annual)</ZoruLabel>
            <ZoruInput
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
            <ZoruLabel>Color</ZoruLabel>
            <input type="hidden" name="color" value={color} />
            <div className="mt-1.5">
              <ZoruColorPicker value={color} onChange={setColor} />
            </div>
          </div>
          <div className="md:col-span-2">
            <ZoruLabel htmlFor="description">Description</ZoruLabel>
            <ZoruTextarea
              id="description"
              name="description"
              rows={3}
              defaultValue={initial?.description ?? ''}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
            <div className="flex-1">
              <div className="text-[13px] text-zoru-ink">Active</div>
              <div className="text-[12px] text-zoru-ink-muted">Inactive designations are hidden from new hires.</div>
            </div>
            <ZoruSwitch checked={active} onCheckedChange={setActive} aria-label="Active" />
          </div>
        </div>
      </ZoruCard>

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link href="/dashboard/crm/hr-payroll/designations">Cancel</Link>
        </ZoruButton>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
