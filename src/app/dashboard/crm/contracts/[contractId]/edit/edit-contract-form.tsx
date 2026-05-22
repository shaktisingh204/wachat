'use client';

import {
  Button,
  Card,
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
import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';

import { updateContractWithDetails } from '@/app/actions/crm-services.actions';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';

interface AttachmentRow {
  id: string;
  name: string;
}

interface SignerRow {
  name: string;
  email: string;
  role: string;
}

interface ContractInitial {
  _id: string;
  title: string;
  status: string;
  clientId: string | null;
  clientName: string;
  value: number | null;
  currency: string;
  startDate: string;
  endDate: string;
  body: string;
  notes: string;
  autoRenew: boolean;
  renewalNoticeDays: number;
  esignProvider: string;
  attachments: AttachmentRow[];
  signers: SignerRow[];
}

interface Props {
  initial: ContractInitial;
}

type ActionResult = { message?: string; error?: string; id?: string };

const initialState: ActionResult = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
      ) : (
        <Save className="h-4 w-4" strokeWidth={1.75} />
      )}
      Save Changes
    </ZoruButton>
  );
}

function computeAutoRenewBanner(
  endDate: string,
  autoRenew: boolean,
  renewalNoticeDays: number,
): string {
  if (!endDate || !autoRenew) return 'Auto-renewal disabled — contract ends on the expiry date.';
  const end = new Date(endDate);
  if (isNaN(end.getTime())) return '';
  const renewOn = new Date(end);
  renewOn.setDate(renewOn.getDate() + 1);
  const cancelBy = new Date(end);
  cancelBy.setDate(cancelBy.getDate() - Math.max(renewalNoticeDays, 0));
  const renewStr = renewOn.toISOString().slice(0, 10);
  const cancelStr = cancelBy.toISOString().slice(0, 10);
  return `Auto-renews on ${renewStr} unless cancelled by ${cancelStr}.`;
}

export function EditContractForm({ initial }: Props) {
  const [state, formAction] = useActionState(
    updateContractWithDetails as unknown as (
      prev: ActionResult,
      formData: FormData,
    ) => Promise<ActionResult>,
    initialState,
  );
  const { toast } = useZoruToast();

  const [endDate, setEndDate] = useState(initial.endDate);
  const [autoRenew, setAutoRenew] = useState(initial.autoRenew);
  const [renewalNoticeDays, setRenewalNoticeDays] = useState(
    initial.renewalNoticeDays,
  );
  const [attachments, setAttachments] = useState<AttachmentRow[]>(
    initial.attachments,
  );
  const [signers, setSigners] = useState<SignerRow[]>(
    initial.signers.length > 0
      ? initial.signers
      : [{ name: '', email: '', role: '' }],
  );

  const renewalBanner = useMemo(
    () => computeAutoRenewBanner(endDate, autoRenew, renewalNoticeDays),
    [endDate, autoRenew, renewalNoticeDays],
  );

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      window.location.href = `/dashboard/crm/contracts/${state.id ?? initial._id}`;
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, initial._id]);

  const onAttachmentPick = (pick: SabFilePick) => {
    setAttachments((prev) =>
      prev.some((a) => a.id === pick.id)
        ? prev
        : [...prev, { id: pick.id, name: pick.name }],
    );
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const updateSigner = (idx: number, patch: Partial<SignerRow>) => {
    setSigners((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    );
  };

  const addSigner = () => {
    setSigners((prev) => [...prev, { name: '', email: '', role: '' }]);
  };

  const removeSigner = (idx: number) => {
    setSigners((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <EntityDetailShell
      eyebrow="CONTRACT"
      title={`Edit ${initial.title || 'Contract'}`}
      back={{
        href: `/dashboard/crm/contracts/${initial._id}`,
        label: 'Back to contract',
      }}
    >
      <form action={formAction}>
        <input type="hidden" name="_id" value={initial._id} />
        <input
          type="hidden"
          name="attachmentsJson"
          value={JSON.stringify(attachments)}
        />
        <input
          type="hidden"
          name="signersJson"
          value={JSON.stringify(
            signers.filter((s) => s.email.trim()).map((s, idx) => ({
              ...s,
              order: idx,
            })),
          )}
        />

        <div className="space-y-6">
          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-zoru-ink">Overview</h2>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Title, status, and currency.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <ZoruLabel
                  htmlFor="title"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Title <span className="text-zoru-danger">*</span>
                </ZoruLabel>
                <ZoruInput
                  id="title"
                  name="title"
                  required
                  defaultValue={initial.title}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="status"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Status
                </ZoruLabel>
                <ZoruSelect name="status" defaultValue={initial.status}>
                  <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                    <ZoruSelectItem value="sent">Sent</ZoruSelectItem>
                    <ZoruSelectItem value="partially_signed">
                      Partially signed
                    </ZoruSelectItem>
                    <ZoruSelectItem value="signed">Signed</ZoruSelectItem>
                    <ZoruSelectItem value="completed">Completed</ZoruSelectItem>
                    <ZoruSelectItem value="expired">Expired</ZoruSelectItem>
                    <ZoruSelectItem value="terminated">Terminated</ZoruSelectItem>
                    <ZoruSelectItem value="voided">Voided</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div className="space-y-2">
                <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                  Currency
                </ZoruLabel>
                <EntityFormField
                  entity="currency"
                  name="currency"
                  initialId={initial.currency || 'INR'}
                  placeholder="Select currency…"
                />
              </div>
            </div>
          </ZoruCard>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-zoru-ink">Parties</h2>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Counter-party account and signers.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                    Counter-party account
                  </ZoruLabel>
                  <EntityFormField
                    entity="account"
                    name="clientId"
                    dualWriteName="clientName"
                    initialId={initial.clientId}
                    initialLabel={initial.clientName}
                    placeholder="Select account…"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <ZoruLabel className="text-[12.5px] text-zoru-ink-muted">
                    Signers
                  </ZoruLabel>
                  <ZoruButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addSigner}
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Add signer
                  </ZoruButton>
                </div>
                <div className="space-y-2">
                  {signers.map((row, idx) => (
                    <div
                      key={`signer-${idx}`}
                      className="grid grid-cols-1 gap-2 rounded-lg border border-zoru-line bg-zoru-bg p-3 md:grid-cols-[1fr_1.4fr_1fr_auto]"
                    >
                      <ZoruInput
                        value={row.name}
                        placeholder="Name"
                        onChange={(e) => updateSigner(idx, { name: e.target.value })}
                        className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                      />
                      <ZoruInput
                        type="email"
                        value={row.email}
                        placeholder="Email"
                        onChange={(e) => updateSigner(idx, { email: e.target.value })}
                        className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                      />
                      <ZoruInput
                        value={row.role}
                        placeholder="Role (e.g. CFO)"
                        onChange={(e) => updateSigner(idx, { role: e.target.value })}
                        className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                      />
                      <ZoruButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSigner(idx)}
                        disabled={signers.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </ZoruButton>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ZoruCard>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-zoru-ink">Terms</h2>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Dates, value, and body.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="startDate"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Start date
                </ZoruLabel>
                <ZoruInput
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={initial.startDate}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="endDate"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  End date
                </ZoruLabel>
                <ZoruInput
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="value"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Value
                </ZoruLabel>
                <ZoruInput
                  id="value"
                  name="value"
                  type="number"
                  step="0.01"
                  defaultValue={initial.value ?? ''}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="esignProvider"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  E-sign provider
                </ZoruLabel>
                <ZoruSelect
                  name="esignProvider"
                  defaultValue={initial.esignProvider || 'internal'}
                >
                  <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="internal">Internal</ZoruSelectItem>
                    <ZoruSelectItem value="digio">Digio</ZoruSelectItem>
                    <ZoruSelectItem value="docusign">DocuSign</ZoruSelectItem>
                    <ZoruSelectItem value="aadhaar">Aadhaar</ZoruSelectItem>
                    <ZoruSelectItem value="none">None</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div className="space-y-2 md:col-span-2">
                <ZoruLabel
                  htmlFor="body"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Contract body
                </ZoruLabel>
                <ZoruTextarea
                  id="body"
                  name="body"
                  rows={8}
                  defaultValue={initial.body}
                  className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            </div>
          </ZoruCard>

          <ZoruCard className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-semibold text-zoru-ink">Documents</h2>
                <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                  Attach files from SabFiles or upload new ones.
                </p>
              </div>
              <SabFilePickerButton onPick={onAttachmentPick} accept="all">
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                Add file
              </SabFilePickerButton>
            </div>
            {attachments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zoru-line bg-zoru-bg px-4 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                No documents attached.
              </div>
            ) : (
              <ul className="divide-y divide-zoru-line rounded-lg border border-zoru-line bg-zoru-bg">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="truncate text-[13px] text-zoru-ink">
                      {a.name}
                    </span>
                    <ZoruButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </ZoruButton>
                  </li>
                ))}
              </ul>
            )}
          </ZoruCard>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-zoru-ink">Renewal</h2>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Auto-renewal cadence and notice window.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <ZoruSwitch
                  id="autoRenew"
                  name="autoRenew"
                  checked={autoRenew}
                  onCheckedChange={setAutoRenew}
                />
                <ZoruLabel
                  htmlFor="autoRenew"
                  className="cursor-pointer text-[13px] text-zoru-ink"
                >
                  Auto-renew this contract
                </ZoruLabel>
              </div>
              <div className="space-y-2">
                <ZoruLabel
                  htmlFor="renewalNoticeDays"
                  className="text-[12.5px] text-zoru-ink-muted"
                >
                  Notice days
                </ZoruLabel>
                <ZoruInput
                  id="renewalNoticeDays"
                  name="renewalNoticeDays"
                  type="number"
                  min={0}
                  value={renewalNoticeDays}
                  onChange={(e) =>
                    setRenewalNoticeDays(Number(e.target.value) || 0)
                  }
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="md:col-span-2 rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3 text-[12.5px] text-zoru-ink-muted">
                {renewalBanner}
              </div>
            </div>
          </ZoruCard>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-zoru-ink">Notes</h2>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Internal notes — not shown to signers.
              </p>
            </div>
            <ZoruTextarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={initial.notes}
              className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
            />
          </ZoruCard>

          <div className="flex justify-end gap-2 border-t border-zoru-line pt-4">
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => {
                window.location.href = `/dashboard/crm/contracts/${initial._id}`;
              }}
            >
              Cancel
            </ZoruButton>
            <SubmitButton />
          </div>
        </div>
      </form>
    </EntityDetailShell>
  );
}
