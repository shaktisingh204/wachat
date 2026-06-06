'use client';

import { Button, Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea, useToast } from '@/components/sabcrm/20ui';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';

import { updateContractWithDetails } from '@/app/actions/crm-services.actions';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { getContractTemplates } from '@/app/actions/worksuite/contracts-ext.actions';
import { ContractStatusTimeline, type ContractStatus } from './contract-status-timeline';

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
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
      ) : (
        <Save className="h-4 w-4" strokeWidth={1.75} />
      )}
      Save Changes
    </Button>
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
  const { toast } = useToast();

  const [status, setStatus] = useState<ContractStatus>((initial.status as ContractStatus) || 'draft');
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
  const [templates, setTemplates] = useState<any[]>([]);
  const [bodyText, setBodyText] = useState(initial.body || '');

  useEffect(() => {
    getContractTemplates().then((data) => {
      setTemplates(data as any[] || []);
    });
  }, []);

  const handleTemplateChange = (templateId: string) => {
    const t = templates.find((x) => x._id === templateId);
    if (t) {
      setBodyText(t.body || '');
    }
  };

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
          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-[var(--st-text)]">Overview</h2>
              <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                Title, status, and currency.
              </p>
            </div>
            
            <div className="mb-8 mt-2 px-4">
              <ContractStatusTimeline status={status} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label
                  htmlFor="title"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Title <span className="text-[var(--st-danger)]">*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  required
                  defaultValue={initial.title}
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="status"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Status
                </Label>
                <Select name="status" value={status} onValueChange={(val) => setStatus(val as ContractStatus)}>
                  <SelectTrigger className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="partially_signed">
                      Partially signed
                    </SelectItem>
                    <SelectItem value="signed">Signed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                    <SelectItem value="voided">Voided</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[12.5px] text-[var(--st-text-secondary)]">
                  Currency
                </Label>
                <EntityFormField
                  entity="currency"
                  name="currency"
                  initialId={initial.currency || 'INR'}
                  placeholder="Select currency…"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-[var(--st-text)]">Parties</h2>
              <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                Counter-party account and signers.
              </p>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[12.5px] text-[var(--st-text-secondary)]">
                    Counter-party account
                  </Label>
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
                  <Label className="text-[12.5px] text-[var(--st-text-secondary)]">
                    Signers
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addSigner}
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Add signer
                  </Button>
                </div>
                <div className="space-y-2">
                  {signers.map((row, idx) => (
                    <div
                      key={`signer-${idx}`}
                      className="grid grid-cols-1 gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] p-3 md:grid-cols-[1fr_1.4fr_1fr_auto]"
                    >
                      <Input
                        value={row.name}
                        placeholder="Name"
                        onChange={(e) => updateSigner(idx, { name: e.target.value })}
                        className="h-9 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                      />
                      <Input
                        type="email"
                        value={row.email}
                        placeholder="Email"
                        onChange={(e) => updateSigner(idx, { email: e.target.value })}
                        className="h-9 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                      />
                      <Input
                        value={row.role}
                        placeholder="Role (e.g. CFO)"
                        onChange={(e) => updateSigner(idx, { role: e.target.value })}
                        className="h-9 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSigner(idx)}
                        disabled={signers.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-[var(--st-text)]">Terms</h2>
              <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                Dates, value, and body.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label
                  htmlFor="startDate"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Start date
                </Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  defaultValue={initial.startDate}
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="endDate"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  End date
                </Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="value"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Value
                </Label>
                <Input
                  id="value"
                  name="value"
                  type="number"
                  step="0.01"
                  defaultValue={initial.value ?? ''}
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="esignProvider"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  E-sign provider
                </Label>
                <Select
                  name="esignProvider"
                  defaultValue={initial.esignProvider || 'internal'}
                >
                  <SelectTrigger className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="digio">Digio</SelectItem>
                    <SelectItem value="docusign">DocuSign</SelectItem>
                    <SelectItem value="aadhaar">Aadhaar</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <div className="flex justify-between items-center">
                  <Label
                    htmlFor="body"
                    className="text-[12.5px] text-[var(--st-text-secondary)]"
                  >
                    Contract body
                  </Label>
                  {templates.length > 0 && (
                    <Select onValueChange={handleTemplateChange}>
                      <SelectTrigger className="h-8 w-[200px] text-[12px]">
                        <SelectValue placeholder="Apply template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t._id} value={t._id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <Textarea
                  id="body"
                  name="body"
                  rows={8}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-semibold text-[var(--st-text)]">Documents</h2>
                <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                  Attach files from SabFiles or upload new ones.
                </p>
              </div>
              <SabFilePickerButton onPick={onAttachmentPick} accept="all">
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                Add file
              </SabFilePickerButton>
            </div>
            {attachments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-6 text-center text-[12.5px] text-[var(--st-text-secondary)]">
                No documents attached.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--st-border)] rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)]">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="truncate text-[13px] text-[var(--st-text)]">
                      {a.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-[var(--st-text)]">Renewal</h2>
              <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                Auto-renewal cadence and notice window.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="autoRenew"
                  name="autoRenew"
                  checked={autoRenew}
                  onCheckedChange={setAutoRenew}
                />
                <Label
                  htmlFor="autoRenew"
                  className="cursor-pointer text-[13px] text-[var(--st-text)]"
                >
                  Auto-renew this contract
                </Label>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="renewalNoticeDays"
                  className="text-[12.5px] text-[var(--st-text-secondary)]"
                >
                  Notice days
                </Label>
                <Input
                  id="renewalNoticeDays"
                  name="renewalNoticeDays"
                  type="number"
                  min={0}
                  value={renewalNoticeDays}
                  onChange={(e) =>
                    setRenewalNoticeDays(Number(e.target.value) || 0)
                  }
                  className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="md:col-span-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3 text-[12.5px] text-[var(--st-text-secondary)]">
                {renewalBanner}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-[var(--st-text)]">Notes</h2>
              <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                Internal notes — not shown to signers.
              </p>
            </div>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={initial.notes}
              className="rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
            />
          </Card>

          <div className="flex justify-end gap-2 border-t border-[var(--st-border)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.location.href = `/dashboard/crm/contracts/${initial._id}`;
              }}
            >
              Cancel
            </Button>
            <SubmitButton />
          </div>
        </div>
      </form>
    </EntityDetailShell>
  );
}
