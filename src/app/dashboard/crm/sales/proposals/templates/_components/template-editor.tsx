'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LayoutTemplate, LoaderCircle, Save } from 'lucide-react';
import { ClayButton, ClayCard } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import { saveProposalTemplate } from '@/app/actions/worksuite/proposals.actions';
import {
  ProposalComposer,
  type ComposerLine,
} from '../../_components/proposal-composer';
import type { WsProposalTemplate } from '@/lib/worksuite/proposals-types';

function newId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface TemplateEditorInitial {
  _id?: string;
  name?: string;
  title?: string;
  currency?: string;
  discount?: number;
  note?: string;
  terms?: string;
  signature_required?: boolean;
  lines?: ComposerLine[];
}

export function TemplateEditor({ initial }: { initial?: TemplateEditorInitial }) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(initial?.name || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [currency, setCurrency] = useState(initial?.currency || 'INR');
  const [discount, setDiscount] = useState(initial?.discount || 0);
  const [note, setNote] = useState(initial?.note || '');
  const [terms, setTerms] = useState(initial?.terms || '');
  const [signatureRequired, setSignatureRequired] = useState(
    initial?.signature_required ?? true,
  );
  const [lines, setLines] = useState<ComposerLine[]>(
    initial?.lines && initial.lines.length
      ? initial.lines
      : [
          {
            id: newId(),
            name: '',
            description: '',
            quantity: 1,
            unit_price: 0,
            tax: 0,
          },
        ],
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Template name required', variant: 'destructive' });
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
    setIsSaving(true);
    const res = await saveProposalTemplate({
      _id: initial?._id,
      name,
      title: title || name,
      currency,
      discount,
      note,
      terms,
      signature_required: signatureRequired,
      lines: cleanLines,
    });
    setIsSaving(false);
    if (res.success) {
      toast({ title: 'Template saved' });
      router.push('/dashboard/crm/sales/proposals/templates');
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={initial?._id ? 'Edit Template' : 'New Template'}
        subtitle="Reusable proposal template. Skip the client picker — apply it later."
        icon={LayoutTemplate}
        actions={
          <Link href="/dashboard/crm/sales/proposals/templates">
            <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
              Templates
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label className="text-foreground">Template Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Standard SaaS Proposal"
              className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
            />
          </div>
          <div className="md:col-span-1">
            <Label className="text-foreground">Default Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Proposal for <Client>"
              className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
            />
          </div>
          <div>
            <Label className="text-foreground">Currency</Label>
            <Input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="mt-1.5 h-10 rounded-lg border-border bg-card text-[13px]"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Switch
            id="signature_required"
            checked={signatureRequired}
            onCheckedChange={setSignatureRequired}
          />
          <Label
            htmlFor="signature_required"
            className="cursor-pointer text-[13px] text-foreground"
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
          variant="obsidian"
          disabled={isSaving}
          onClick={handleSave}
          leading={
            isSaving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )
          }
        >
          Save Template
        </ClayButton>
      </div>
    </div>
  );
}

export function templateToComposerLines(
  items: {
    _id: string;
    name: string;
    description?: string;
    quantity: number;
    unit_price: number;
    tax: number;
  }[],
): ComposerLine[] {
  return items.map((i) => ({
    id: i._id,
    name: i.name,
    description: i.description || '',
    quantity: Number(i.quantity || 0),
    unit_price: Number(i.unit_price || 0),
    tax: Number(i.tax || 0),
  }));
}

export function initialFromTemplate(
  t: WsProposalTemplate & { _id: string },
  items: {
    _id: string;
    name: string;
    description?: string;
    quantity: number;
    unit_price: number;
    tax: number;
  }[],
): TemplateEditorInitial {
  return {
    _id: t._id,
    name: t.name,
    title: t.title,
    currency: t.currency,
    discount: t.discount,
    note: t.note,
    terms: t.terms,
    signature_required: t.signature_required,
    lines: templateToComposerLines(items),
  };
}
