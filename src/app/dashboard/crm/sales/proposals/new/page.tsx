'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSwitch,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutTemplate,
  LoaderCircle,
  Save,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityPicker } from '@/components/crm/entity-picker';
import {
  saveProposal,
  createProposalFromTemplate,
  getProposalTemplates,
} from '@/app/actions/worksuite/proposals.actions';
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
  const { toast } = useZoruToast();

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

  const [templates, setTemplates] = useState<(WsProposalTemplate & { _id: string })[]>(
    [],
  );
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingTemplate, startApplyTemplate] = useTransition();

  const fetchAuxData = useCallback(async () => {
    const tpls = await getProposalTemplates();
    setTemplates(tpls);
  }, []);

  useEffect(() => {
    fetchAuxData();
  }, [fetchAuxData]);

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
    <EntityListShell
      title="New Proposal"
      subtitle="Compose a sales proposal with line items, terms, and totals."
    >

      <ZoruCard className="p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <ZoruLabel className="text-zoru-ink">Title</ZoruLabel>
            <ZoruInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Website redesign – Phase 1"
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel className="text-zoru-ink">Currency</ZoruLabel>
            <div className="mt-1.5">
              <EntityPicker
                entity="currency"
                value={currency || null}
                onChange={(next) => {
                  const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                  setCurrency(id || 'INR');
                }}
              />
            </div>
          </div>

          <div>
            <ZoruLabel className="text-zoru-ink">Client</ZoruLabel>
            <div className="mt-1.5">
              <EntityPicker
                entity="client"
                value={clientId || null}
                placeholder="Select client"
                onChange={(next) => {
                  const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                  setClientId(id);
                }}
              />
            </div>
          </div>
          <div>
            <ZoruLabel className="text-zoru-ink">Issue Date</ZoruLabel>
            <ZoruInput
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <ZoruLabel className="text-zoru-ink">Valid Until</ZoruLabel>
            <ZoruInput
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-zoru-line bg-zoru-surface-2 p-3">
          <div className="flex items-center gap-3">
            <LayoutTemplate
              className="h-4 w-4 text-zoru-ink-muted"
              strokeWidth={1.75}
            />
            <span className="text-[12.5px] text-zoru-ink">
              Start from a template
            </span>
            <ZoruSelect value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <ZoruSelectTrigger className="w-60">
                <ZoruSelectValue placeholder="Select template" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {templates.length === 0 ? (
                  <ZoruSelectItem value="__none" disabled>
                    No templates yet
                  </ZoruSelectItem>
                ) : (
                  templates.map((t) => (
                    <ZoruSelectItem key={t._id} value={t._id}>
                      {t.name}
                    </ZoruSelectItem>
                  ))
                )}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <ZoruButton
            variant="outline"
            disabled={!selectedTemplate || isApplyingTemplate}
            onClick={applyTemplate}
          >
            {isApplyingTemplate ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            Use Template
          </ZoruButton>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <ZoruSwitch
            id="signature_required"
            checked={signatureRequired}
            onCheckedChange={setSignatureRequired}
          />
          <ZoruLabel
            htmlFor="signature_required"
            className="cursor-pointer text-[13px] text-zoru-ink"
          >
            Require e-signature on acceptance
          </ZoruLabel>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
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
      </ZoruCard>

      <div className="flex flex-wrap justify-end gap-2">
        <ZoruButton
          variant="outline"
          disabled={isSaving}
          onClick={() => handleSave('draft')}
        >
          {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          Save as Draft
        </ZoruButton>
        <ZoruButton
          disabled={isSaving}
          onClick={() => handleSave('sent')}
        >
          {isSaving ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save &amp; Send
        </ZoruButton>
      </div>
    </EntityListShell>
  );
}
