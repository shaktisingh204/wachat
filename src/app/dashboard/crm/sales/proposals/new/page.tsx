'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  LayoutTemplate,
  LoaderCircle,
  Save,
} from 'lucide-react';
import { ClayButton, ClayCard } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  saveProposal,
  createProposalFromTemplate,
  getProposalTemplates,
} from '@/app/actions/worksuite/proposals.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmAccount } from '@/lib/definitions';
import type { WsProposalTemplate } from '@/lib/worksuite/proposals-types';
import {
  ProposalComposer,
  type ComposerLine,
} from '../_components/proposal-composer';

function newId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function NewProposalPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [issueDate, setIssueDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [validUntil, setValidUntil] = useState('');
  const [signatureRequired, setSignatureRequired] = useState(true);
  const [discount, setDiscount] = useState(0);
  const [note, setNote] = useState('');
  const [terms, setTerms] = useState('');
  const [lines, setLines] = useState<ComposerLine[]>([
    { id: newId(), name: '', description: '', quantity: 1, unit_price: 0, tax: 0 },
  ]);

  const [accounts, setAccounts] = useState<WithId<CrmAccount>[]>([]);
  const [templates, setTemplates] = useState<(WsProposalTemplate & { _id: string })[]>(
    [],
  );
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingTemplate, startApplyTemplate] = useTransition();

  const fetchAuxData = useCallback(async () => {
    const [accRes, tpls] = await Promise.all([
      getCrmAccounts(1, 100),
      getProposalTemplates(),
    ]);
    setAccounts(accRes.accounts);
    setTemplates(tpls);
  }, []);

  useEffect(() => {
    fetchAuxData();
  }, [fetchAuxData]);

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        id: String(a._id),
        name: a.name || 'Unnamed',
      })),
    [accounts],
  );

  const applyTemplate = () => {
    if (!selectedTemplate) return;
    startApplyTemplate(async () => {
      if (!clientId) {
        toast({
          title: 'Pick a client first',
          description: 'Select a client before applying a template.',
          variant: 'destructive',
        });
        return;
      }
      const res = await createProposalFromTemplate(selectedTemplate, clientId);
      if (res.success) {
        toast({
          title: 'Proposal created',
          description: 'A proposal has been created from the template.',
        });
        router.push(`/dashboard/crm/sales/proposals/${res.id}`);
      } else {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const handleSave = async (status: 'draft' | 'sent') => {
    if (!title.trim()) {
      toast({ title: 'Missing title', variant: 'destructive' });
      return;
    }
    const cleanLines = lines
      .filter((l) => l.name.trim())
      .map((l) => ({
        name: l.name,
        description: l.description,
        quantity: Number(l.quantity || 0),
        unit_price: Number(l.unit_price || 0),
        tax: Number(l.tax || 0),
      }));
    if (cleanLines.length === 0) {
      toast({
        title: 'Add at least one line item',
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    const res = await saveProposal({
      title,
      client_id: clientId || undefined,
      currency,
      issue_date: issueDate,
      valid_until: validUntil || undefined,
      discount,
      note,
      terms,
      signature_required: signatureRequired,
      status,
      lines: cleanLines,
    });
    setIsSaving(false);
    if (res.success) {
      toast({ title: 'Proposal saved' });
      router.push(`/dashboard/crm/sales/proposals/${res.id}`);
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Proposal"
        subtitle="Compose a sales proposal with line items, terms, and totals."
        icon={FileText}
        actions={
          <Link href="/dashboard/crm/sales/proposals">
            <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
              All Proposals
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label className="text-clay-ink">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Website redesign – Phase 1"
              className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
          <div>
            <Label className="text-clay-ink">Currency</Label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>

          <div>
            <Label className="text-clay-ink">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No clients yet
                  </SelectItem>
                ) : (
                  accountOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-clay-ink">Issue Date</Label>
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
          <div>
            <Label className="text-clay-ink">Valid Until</Label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-clay-md border border-dashed border-clay-border bg-clay-surface-2 p-3">
          <div className="flex items-center gap-3">
            <LayoutTemplate
              className="h-4 w-4 text-clay-ink-muted"
              strokeWidth={1.75}
            />
            <span className="text-[12.5px] text-clay-ink">
              Start from a template
            </span>
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="h-9 w-60 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No templates yet
                  </SelectItem>
                ) : (
                  templates.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <ClayButton
            variant="pill"
            disabled={!selectedTemplate || isApplyingTemplate}
            onClick={applyTemplate}
            leading={
              isApplyingTemplate ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : undefined
            }
          >
            Use Template
          </ClayButton>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Switch
            id="signature_required"
            checked={signatureRequired}
            onCheckedChange={setSignatureRequired}
          />
          <Label
            htmlFor="signature_required"
            className="cursor-pointer text-[13px] text-clay-ink"
          >
            Require e-signature on acceptance
          </Label>
        </div>
      </ClayCard>

      <ClayCard>
        <ProposalComposer
          lines={lines}
          onLinesChange={setLines}
          discount={discount}
          onDiscountChange={setDiscount}
          note={note}
          onNoteChange={setNote}
          terms={terms}
          onTermsChange={setTerms}
          currency={currency}
        />
      </ClayCard>

      <div className="flex flex-wrap justify-end gap-2">
        <ClayButton
          variant="pill"
          disabled={isSaving}
          onClick={() => handleSave('draft')}
          leading={
            isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined
          }
        >
          Save as Draft
        </ClayButton>
        <ClayButton
          variant="obsidian"
          disabled={isSaving}
          onClick={() => handleSave('sent')}
          leading={
            isSaving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )
          }
        >
          Save &amp; Send
        </ClayButton>
      </div>
    </div>
  );
}
