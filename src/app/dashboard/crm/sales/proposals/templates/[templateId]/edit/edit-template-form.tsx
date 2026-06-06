'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';

import { saveProposalTemplate } from '@/app/actions/worksuite/proposals.actions';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export interface TemplateSection {
  id: string;
  title: string;
  content: string;
  quantity: number;
  unitPrice: number;
  tax: number;
}

export interface TemplateFormInitial {
  _id: string;
  name: string;
  title: string;
  currency: string;
  discount: number;
  note: string;
  terms: string;
  signatureRequired: boolean;
  sections: TemplateSection[];
}

interface Props {
  initial: TemplateFormInitial;
}

const VARIABLES: { token: string; label: string; sample: string }[] = [
  { token: '{{client.name}}', label: 'Client name', sample: 'Acme Corp' },
  { token: '{{client.email}}', label: 'Client email', sample: 'cfo@acme.com' },
  { token: '{{deal.name}}', label: 'Deal name', sample: 'Q3 expansion' },
  { token: '{{deal.value}}', label: 'Deal value', sample: '50,000' },
  { token: '{{deal.currency}}', label: 'Currency', sample: 'USD' },
  { token: '{{today}}', label: 'Today', sample: new Date().toISOString().slice(0, 10) },
  { token: '{{owner.name}}', label: 'Owner name', sample: 'You' },
  { token: '{{company.name}}', label: 'Your company', sample: 'SabNode' },
];

const SAMPLE_MAP = VARIABLES.reduce<Record<string, string>>((acc, v) => {
  acc[v.token] = v.sample;
  return acc;
}, {});

function applySample(text: string): string {
  return text.replace(/\{\{[^}]+\}\}/g, (m) => SAMPLE_MAP[m] ?? m);
}

function newSectionId(): string {
  return `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function EditTemplateForm({ initial }: Props) {
  const router = useRouter();
  const { toast } = useZoruToast();

  const [name, setName] = useState(initial.name);
  const [title, setTitle] = useState(initial.title);
  const [currency, setCurrency] = useState(initial.currency);
  const [discount, setDiscount] = useState<number>(initial.discount);
  const [note, setNote] = useState(initial.note);
  const [terms, setTerms] = useState(initial.terms);
  const [signatureRequired, setSignatureRequired] = useState(
    initial.signatureRequired,
  );
  const [sections, setSections] = useState<TemplateSection[]>(
    initial.sections.length > 0
      ? initial.sections
      : [
          {
            id: newSectionId(),
            title: 'Scope of work',
            content: 'Describe the deliverables for {{client.name}} here.',
            quantity: 1,
            unitPrice: 0,
            tax: 0,
          },
        ],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>(
    sections[0]?.id ?? '',
  );

  const contentRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const subtotal = useMemo(
    () => sections.reduce((sum, s) => sum + s.quantity * s.unitPrice, 0),
    [sections],
  );
  const taxTotal = useMemo(
    () =>
      sections.reduce(
        (sum, s) => sum + (s.quantity * s.unitPrice * s.tax) / 100,
        0,
      ),
    [sections],
  );
  const grandTotal = useMemo(
    () => Math.max(0, subtotal + taxTotal - (Number(discount) || 0)),
    [subtotal, taxTotal, discount],
  );

  const updateSection = (id: string, patch: Partial<TemplateSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  };

  const addSection = () => {
    const id = newSectionId();
    setSections((prev) => [
      ...prev,
      {
        id,
        title: 'New section',
        content: '',
        quantity: 1,
        unitPrice: 0,
        tax: 0,
      },
    ]);
    setActiveSectionId(id);
  };

  const removeSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const moveSection = (id: string, direction: -1 | 1) => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const next = idx + direction;
      if (next < 0 || next >= prev.length) return prev;
      const copy = prev.slice();
      const [item] = copy.splice(idx, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  };

  const insertToken = (token: string) => {
    const id = activeSectionId;
    if (!id) {
      toast({
        title: 'Pick a section first',
        description: 'Click into a section content area, then insert.',
        variant: 'destructive',
      });
      return;
    }
    const el = contentRefs.current[id];
    const section = sections.find((s) => s.id === id);
    if (!section) return;
    if (el) {
      const start = el.selectionStart ?? section.content.length;
      const end = el.selectionEnd ?? section.content.length;
      const next =
        section.content.slice(0, start) + token + section.content.slice(end);
      updateSection(id, { content: next });
      // restore cursor after token
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        const caret = start + token.length;
        el.setSelectionRange(caret, caret);
      });
    } else {
      updateSection(id, { content: `${section.content}${token}` });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Template name required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const res = await saveProposalTemplate({
      _id: initial._id,
      name,
      title: title || name,
      currency,
      discount,
      note,
      terms,
      signature_required: signatureRequired,
      lines: sections.map((s) => ({
        name: s.title,
        description: s.content,
        quantity: Number(s.quantity || 0),
        unit_price: Number(s.unitPrice || 0),
        tax: Number(s.tax || 0),
      })),
    });
    setIsSaving(false);
    if (res.success) {
      toast({ title: 'Template saved' });
      router.push(
        `/dashboard/crm/sales/proposals/templates/${res.id ?? initial._id}`,
      );
    } else {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <EntityDetailShell
      eyebrow="PROPOSAL TEMPLATE"
      title={`Edit ${initial.name || 'Template'}`}
      back={{
        href: `/dashboard/crm/sales/proposals/templates/${initial._id}`,
        label: 'Back to template',
      }}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-zoru-ink">
                Template basics
              </h2>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Name and default proposal title.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-[12.5px] text-zoru-ink-muted">
                  Template name <span className="text-zoru-danger">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Standard SaaS Proposal"
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12.5px] text-zoru-ink-muted">
                  Default proposal title
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Proposal for {{client.name}}"
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12.5px] text-zoru-ink-muted">
                  Currency
                </Label>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12.5px] text-zoru-ink-muted">
                  Default discount
                </Label>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="flex items-end gap-2">
                <Switch
                  id="signatureRequired"
                  checked={signatureRequired}
                  onCheckedChange={setSignatureRequired}
                />
                <Label
                  htmlFor="signatureRequired"
                  className="cursor-pointer pb-2 text-[13px] text-zoru-ink"
                >
                  Require e-signature
                </Label>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-semibold text-zoru-ink">Sections</h2>
                <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                  Each section maps to one proposal line item.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSection}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                Add section
              </Button>
            </div>
            <div className="space-y-4">
              {sections.map((section, idx) => (
                <div
                  key={section.id}
                  className={`rounded-lg border bg-zoru-bg p-4 transition-colors ${
                    activeSectionId === section.id
                      ? 'border-zoru-ink/40'
                      : 'border-zoru-line'
                  }`}
                  onClick={() => setActiveSectionId(section.id)}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Input
                      value={section.title}
                      onChange={(e) =>
                        updateSection(section.id, { title: e.target.value })
                      }
                      placeholder="Section title"
                      className="h-9 flex-1 rounded-lg border-zoru-line bg-zoru-bg text-[13px] font-medium"
                    />
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSection(section.id, -1);
                        }}
                        disabled={idx === 0}
                      >
                        <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveSection(section.id, 1);
                        }}
                        disabled={idx === sections.length - 1}
                      >
                        <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSection(section.id);
                        }}
                        disabled={sections.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    ref={(el) => {
                      contentRefs.current[section.id] = el;
                    }}
                    value={section.content}
                    onChange={(e) =>
                      updateSection(section.id, { content: e.target.value })
                    }
                    onFocus={() => setActiveSectionId(section.id)}
                    placeholder="Body — supports tokens like {{client.name}}."
                    rows={5}
                    className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                  />
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-zoru-ink-muted">
                        Quantity
                      </Label>
                      <Input
                        type="number"
                        value={section.quantity}
                        onChange={(e) =>
                          updateSection(section.id, {
                            quantity: Number(e.target.value) || 0,
                          })
                        }
                        className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-zoru-ink-muted">
                        Unit price
                      </Label>
                      <Input
                        type="number"
                        value={section.unitPrice}
                        onChange={(e) =>
                          updateSection(section.id, {
                            unitPrice: Number(e.target.value) || 0,
                          })
                        }
                        className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-zoru-ink-muted">
                        Tax %
                      </Label>
                      <Input
                        type="number"
                        value={section.tax}
                        onChange={(e) =>
                          updateSection(section.id, {
                            tax: Number(e.target.value) || 0,
                          })
                        }
                        className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-zoru-ink">
                Note &amp; terms
              </h2>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Boilerplate text printed at the end of every proposal.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[12.5px] text-zoru-ink-muted">
                  Note
                </Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[12.5px] text-zoru-ink-muted">
                  Terms
                </Label>
                <Textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={4}
                  className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-zoru-ink">
                Live preview
              </h2>
              <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                Tokens rendered with sample values.
              </p>
            </div>
            <div className="space-y-4 rounded-lg border border-zoru-line bg-zoru-bg p-5">
              <div>
                <p className="text-[18px] font-semibold text-zoru-ink">
                  {applySample(title || name) || 'Untitled proposal'}
                </p>
              </div>
              {sections.map((section) => (
                <div key={`preview-${section.id}`} className="space-y-1">
                  <p className="text-[14px] font-semibold text-zoru-ink">
                    {applySample(section.title) || 'Section'}
                  </p>
                  <p className="whitespace-pre-wrap text-[13px] text-zoru-ink-muted">
                    {applySample(section.content) || '—'}
                  </p>
                  <p className="text-[12px] text-zoru-ink-muted">
                    {section.quantity} × {section.unitPrice.toLocaleString()}{' '}
                    {currency} · tax {section.tax}%
                  </p>
                </div>
              ))}
              <div className="border-t border-zoru-line pt-3 text-[13px] text-zoru-ink">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>
                    {subtotal.toLocaleString()} {currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>
                    {taxTotal.toLocaleString()} {currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Discount</span>
                  <span>
                    {Number(discount || 0).toLocaleString()} {currency}
                  </span>
                </div>
                <div className="mt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>
                    {grandTotal.toLocaleString()} {currency}
                  </span>
                </div>
              </div>
              {note && (
                <p className="whitespace-pre-wrap text-[12.5px] text-zoru-ink-muted">
                  {applySample(note)}
                </p>
              )}
              {terms && (
                <p className="whitespace-pre-wrap text-[11.5px] text-zoru-ink-muted">
                  {applySample(terms)}
                </p>
              )}
            </div>
          </Card>

          <div className="flex justify-end gap-2 border-t border-zoru-line pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                router.push(
                  `/dashboard/crm/sales/proposals/templates/${initial._id}`,
                )
              }
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  strokeWidth={1.75}
                />
              ) : (
                <Save className="h-4 w-4" strokeWidth={1.75} />
              )}
              Save template
            </Button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="p-5">
            <div className="mb-3">
              <h2 className="text-[13px] font-semibold text-zoru-ink">
                Variables
              </h2>
              <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted">
                Click to insert into the active section.
              </p>
            </div>
            <ul className="space-y-1.5">
              {VARIABLES.map((v) => (
                <li key={v.token}>
                  <button
                    type="button"
                    onClick={() => insertToken(v.token)}
                    className="w-full rounded-md border border-zoru-line bg-zoru-bg px-2.5 py-1.5 text-left transition-colors hover:border-zoru-ink/40"
                  >
                    <div className="text-[12.5px] font-medium text-zoru-ink">
                      {v.label}
                    </div>
                    <div className="font-mono text-[11px] text-zoru-ink-muted">
                      {v.token}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </EntityDetailShell>
  );
}
