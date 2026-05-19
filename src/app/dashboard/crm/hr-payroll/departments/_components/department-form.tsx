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
import { saveDepartmentAction } from '@/app/actions/crm/departments.actions';
import type { CrmDepartmentDoc } from '@/lib/rust-client/crm-departments';

interface Props {
  initial?: CrmDepartmentDoc | null;
}

const INITIAL_STATE = { message: undefined, error: undefined, id: undefined };

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {editing ? 'Save changes' : 'Create department'}
    </ZoruButton>
  );
}

export function DepartmentForm({ initial }: Props) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(saveDepartmentAction, INITIAL_STATE);
  const editing = !!initial?._id;

  const [active, setActive] = React.useState<boolean>(initial?.active !== false);
  const [color, setColor] = React.useState<string>(initial?.color ?? '#F59E0B');

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/crm/hr-payroll/departments');
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
            <ZoruInput id="name" name="name" required defaultValue={initial?.name ?? ''} className="mt-1.5" placeholder="Engineering" />
          </div>
          <div>
            <ZoruLabel htmlFor="code">Code</ZoruLabel>
            <ZoruInput id="code" name="code" defaultValue={initial?.code ?? ''} className="mt-1.5" placeholder="ENG" />
          </div>
          <div>
            <ZoruLabel>Parent department</ZoruLabel>
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
            <ZoruLabel>Head (employee)</ZoruLabel>
            <div className="mt-1.5">
              <EntityFormField
                entity="employee"
                name="headId"
                initialId={initial?.headId ?? null}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="costCenter">Cost center</ZoruLabel>
            <ZoruInput
              id="costCenter"
              name="costCenter"
              defaultValue={initial?.costCenter ?? ''}
              className="mt-1.5"
              placeholder="e.g. CC-ENG-01"
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
              <div className="text-[12px] text-zoru-ink-muted">
                Inactive departments are hidden from new employee selectors.
              </div>
            </div>
            <ZoruSwitch checked={active} onCheckedChange={setActive} aria-label="Active" />
          </div>
        </div>
      </ZoruCard>

      <div className="flex justify-end gap-2">
        <ZoruButton variant="outline" asChild>
          <Link href="/dashboard/crm/hr-payroll/departments">Cancel</Link>
        </ZoruButton>
        <SubmitButton editing={editing} />
      </div>
    </form>
  );
}
