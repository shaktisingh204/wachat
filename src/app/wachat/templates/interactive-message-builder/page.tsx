'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  ZoruRadioCard,
  RadioGroup,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { useState, useEffect, useMemo } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import {
  Plus,
  Trash2,
  Copy,
  Send,
  Save,
  Download,
  Smartphone,
  MessageSquare,
  List as ListIcon,
  ShoppingBag,
  MapPin,
  Sparkles as SparklesIcon,
  LayoutGrid,
  CircleCheck,
  CircleX,
  TriangleAlert,
  Variable,
  ChevronRight,
  ChevronDown,
  Library,
  Pin,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  MsgType,
  ListSection,
  ListRow,
  CarouselCard,
  InteractiveMessageState,
  InteractiveButton,
  buildInteractivePayload,
} from './utils';

import {
  WaPage,
  PageHeader,
  WaButton,
  PhoneFrame,
  ChatBubble,
  MetricTile,
} from '@/components/wachat-ui';

import * as React from 'react';

/* ── Type options with icons ──────────────────────────────────── */

const TYPE_OPTIONS: {
  value: MsgType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>;
}[] = [
  { value: 'buttons',          label: 'Buttons',          desc: 'Up to 3 reply buttons',         icon: MessageSquare },
  { value: 'list',             label: 'List menu',        desc: 'Sectioned options menu',         icon: ListIcon },
  { value: 'product',          label: 'Product',          desc: 'Catalog-driven product card',    icon: ShoppingBag },
  { value: 'location_request', label: 'Location request', desc: 'Ask the user to share location', icon: MapPin },
  { value: 'flow',             label: 'Flow',             desc: 'Trigger a WhatsApp Flow',        icon: SparklesIcon },
  { value: 'carousel',         label: 'Carousel',         desc: 'Scrollable cards',               icon: LayoutGrid },
];

/* ── Common quick-button library ──────────────────────────────── */

const QUICK_BUTTON_LIBRARY = [
  { group: 'Sales',    items: ['Buy now', 'View pricing', 'Request quote', 'Talk to sales'] },
  { group: 'Support',  items: ['Get help', 'Contact agent', 'Open ticket', 'FAQs'] },
  { group: 'Booking',  items: ['Book appointment', 'Reschedule', 'Cancel booking', 'View details'] },
  { group: 'Generic',  items: ['Yes', 'No', 'Maybe', 'Tell me more', 'Skip'] },
];

const LIST_TEMPLATE_LIBRARY: { name: string; sections: ListSection[] }[] = [
  {
    name: 'Support menu',
    sections: [
      {
        title: 'Get help',
        rows: [
          { title: 'Account', description: 'Login, password, profile', id: 'help_account' },
          { title: 'Billing', description: 'Invoices, payments, refunds', id: 'help_billing' },
          { title: 'Technical', description: 'Bugs, integrations, API', id: 'help_tech' },
        ],
      },
    ],
  },
  {
    name: 'Booking',
    sections: [
      {
        title: 'Choose a time',
        rows: [
          { title: 'Morning', description: '9 AM - 12 PM', id: 'slot_am' },
          { title: 'Afternoon', description: '12 PM - 5 PM', id: 'slot_pm' },
          { title: 'Evening', description: '5 PM - 8 PM', id: 'slot_eve' },
        ],
      },
    ],
  },
];

/* ── Page ──────────────────────────────────────────────────────── */

export default function InteractiveMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const reduceMotion = useReducedMotion();

  const [msgType, setMsgType] = useState<MsgType>('buttons');
  const [body, setBody] = useState('Please choose an option below:');
  const [buttons, setButtons] = useState<InteractiveButton[]>([
    { label: 'Option A', id: '' },
    { label: 'Option B', id: '' },
    { label: '', id: '' },
  ]);
  const [sections, setSections] = useState<ListSection[]>([
    {
      title: 'Main Menu',
      rows: [
        { title: 'Sales', description: 'Talk to sales', id: '' },
        { title: 'Support', description: 'Get help', id: '' },
      ],
    },
  ]);
  const [flowId, setFlowId] = useState('');
  const [flowCta, setFlowCta] = useState('Open Flow');
  const [flowToken, setFlowToken] = useState('');

  const [carouselCards, setCarouselCards] = useState<CarouselCard[]>([
    { title: 'Card 1', body: 'Description 1', buttonLabel: 'Action 1' },
  ]);

  const [testOpen, setTestOpen] = useState(false);
  const [testNumber, setTestNumber] = useState('');

  // Templates state
  const [templateName, setTemplateName] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<
    { name: string; state: InteractiveMessageState }[]
  >([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [openCardIndex, setOpenCardIndex] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('wachat_interactive_templates');
      if (stored) setSavedTemplates(JSON.parse(stored));
    } catch (e) {}
  }, []);

  const getState = (): InteractiveMessageState => ({
    msgType,
    body,
    buttons,
    sections,
    flowId,
    flowCta,
    flowToken,
    carouselCards,
  });

  const loadState = (s: InteractiveMessageState) => {
    setMsgType(s.msgType || 'buttons');
    setBody(s.body || '');
    setButtons(s.buttons || [{ label: '', id: '' }]);
    setSections(s.sections || []);
    setFlowId(s.flowId || '');
    setFlowCta(s.flowCta || 'Open Flow');
    setFlowToken(s.flowToken || '');
    setCarouselCards(s.carouselCards || []);
    setTemplatesOpen(false);
    toast({ title: 'Template loaded' });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast({ title: 'Template name required', variant: 'destructive' });
      return;
    }
    const newTemplates = [...savedTemplates, { name: templateName, state: getState() }];
    setSavedTemplates(newTemplates);
    localStorage.setItem('wachat_interactive_templates', JSON.stringify(newTemplates));
    setTemplateName('');
    setSaveTemplateOpen(false);
    toast({ title: 'Template saved' });
  };

  const handleDeleteTemplate = (i: number) => {
    const newTemplates = savedTemplates.filter((_, idx) => idx !== i);
    setSavedTemplates(newTemplates);
    localStorage.setItem('wachat_interactive_templates', JSON.stringify(newTemplates));
  };

  const validateState = (): boolean => {
    if (msgType === 'list') {
      if (sections.length === 0) return false;
      for (const sec of sections) {
        if (!sec.title.trim()) return false;
        if (sec.rows.length === 0) return false;
        for (const row of sec.rows) {
          if (!row.title.trim()) return false;
        }
      }
    }
    if (msgType === 'flow') {
      if (!flowId.trim()) return false;
    }
    return true;
  };

  const updateButton = (i: number, patch: Partial<InteractiveButton>) =>
    setButtons((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));

  const addSection = () =>
    setSections((p) => [...p, { title: '', rows: [{ title: '', description: '', id: '' }] }]);
  const removeSection = (i: number) => setSections((p) => p.filter((_, idx) => idx !== i));
  const updateSection = (i: number, title: string) =>
    setSections((p) => p.map((s, idx) => (idx === i ? { ...s, title } : s)));
  const addRow = (si: number) =>
    setSections((p) =>
      p.map((s, idx) =>
        idx === si
          ? { ...s, rows: [...s.rows, { title: '', description: '', id: '' }] }
          : s,
      ),
    );
  const updateRow = (si: number, ri: number, patch: Partial<ListRow>) => {
    setSections((p) =>
      p.map((s, idx) =>
        idx === si
          ? { ...s, rows: s.rows.map((r, j) => (j === ri ? { ...r, ...patch } : r)) }
          : s,
      ),
    );
  };
  const removeRow = (si: number, ri: number) =>
    setSections((p) =>
      p.map((s, idx) => (idx === si ? { ...s, rows: s.rows.filter((_, j) => j !== ri) } : s)),
    );

  const addCard = () =>
    setCarouselCards((p) => [...p, { title: '', body: '', buttonLabel: '' }]);
  const updateCard = (i: number, patch: Partial<CarouselCard>) =>
    setCarouselCards((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCard = (i: number) => setCarouselCards((p) => p.filter((_, idx) => idx !== i));

  const handleCopy = async () => {
    if (!validateState()) {
      toast({
        title: 'Validation error',
        description: 'Please fill out all required fields properly.',
        variant: 'destructive',
      });
      return;
    }
    const payload = buildInteractivePayload(getState());
    const json = JSON.stringify(payload, null, 2);
    await navigator.clipboard.writeText(json);
    toast({ title: 'Copied to clipboard', description: 'Interactive message JSON payload copied.' });
  };

  const handleSendTest = async () => {
    if (!validateState()) {
      toast({
        title: 'Validation error',
        description: 'Please fill out all required fields properly.',
        variant: 'destructive',
      });
      return;
    }
    if (!testNumber.trim()) {
      toast({
        title: 'Phone number required',
        description: 'Enter a recipient WhatsApp number to test send.',
        variant: 'destructive',
      });
      return;
    }
    const payload = buildInteractivePayload(getState());
    const json = JSON.stringify(payload, null, 2);
    await navigator.clipboard.writeText(json);
    toast({
      title: 'Test prepared',
      description: `Payload copied. Send to ${testNumber} via your test panel.`,
    });
    setTestOpen(false);
  };

  /* ── stats / metrics ──────────────────────────────────────── */

  const stats = useMemo(() => {
    const filledButtons = buttons.filter((b) => b.label.trim()).length;
    const totalRows = sections.reduce((acc, s) => acc + s.rows.length, 0);
    const filledRows = sections.reduce(
      (acc, s) => acc + s.rows.filter((r) => r.title.trim()).length,
      0,
    );
    const charCount = body.length;
    const varCount = (body.match(/{{\s*\d+\s*}}/g) || []).length;
    return { filledButtons, totalRows, filledRows, charCount, varCount };
  }, [buttons, sections, body]);

  /* ── validation checks ────────────────────────────────────── */

  type Check = { ok: boolean; severity: 'error' | 'warn'; label: string };
  const checks = useMemo<Check[]>(() => {
    const out: Check[] = [];
    out.push({ ok: body.trim().length > 0, severity: 'error', label: 'Body text is set.' });
    out.push({ ok: body.length <= 1024, severity: 'error', label: 'Body within 1024 chars.' });

    if (msgType === 'buttons') {
      const filled = buttons.filter((b) => b.label.trim());
      out.push({ ok: filled.length >= 1, severity: 'error', label: 'At least 1 button label.' });
      out.push({ ok: filled.length <= 3, severity: 'error', label: 'Max 3 reply buttons.' });
      out.push({
        ok: filled.every((b) => b.label.length <= 20),
        severity: 'warn',
        label: 'Button labels under 20 chars (WhatsApp truncates longer).',
      });
    }
    if (msgType === 'list') {
      out.push({ ok: sections.length >= 1, severity: 'error', label: 'At least 1 section.' });
      out.push({ ok: sections.length <= 10, severity: 'error', label: 'Max 10 sections.' });
      out.push({
        ok: sections.every((s) => s.title.trim().length > 0),
        severity: 'error',
        label: 'Every section has a title.',
      });
      out.push({
        ok: sections.every((s) => s.rows.length > 0 && s.rows.every((r) => r.title.trim().length > 0)),
        severity: 'error',
        label: 'Every row has a title.',
      });
      const totalRows = sections.reduce((acc, s) => acc + s.rows.length, 0);
      out.push({ ok: totalRows <= 10, severity: 'error', label: 'Max 10 list rows total.' });
    }
    if (msgType === 'flow') {
      out.push({ ok: flowId.trim().length > 0, severity: 'error', label: 'Flow ID provided.' });
      out.push({ ok: flowCta.trim().length > 0, severity: 'error', label: 'Flow CTA label set.' });
    }
    if (msgType === 'carousel') {
      out.push({ ok: carouselCards.length >= 1, severity: 'error', label: 'At least 1 carousel card.' });
      out.push({ ok: carouselCards.length <= 10, severity: 'error', label: 'Max 10 carousel cards.' });
    }
    return out;
  }, [msgType, body, buttons, sections, flowId, flowCta, carouselCards]);

  const errors = checks.filter((c) => !c.ok && c.severity === 'error').length;
  const warnings = checks.filter((c) => !c.ok && c.severity === 'warn').length;
  const isValid = errors === 0;

  /* ── render ──────────────────────────────────────────────── */

  return (
    <WaPage>
      <PageHeader
        title="Interactive messages"
        description="Build interactive WhatsApp messages with buttons, lists, flows, and more. Preview, validate, and copy the JSON payload."
        kicker={`Wachat · ${activeProject?.name ?? 'project'}`}
        backHref="/wachat/templates"
        eyebrowIcon={Smartphone}
        actions={
          <>
            <WaButton variant="outline" size="sm" leftIcon={Library} onClick={() => setLibraryOpen(true)}>
              Quick library
            </WaButton>
            <WaButton variant="outline" size="sm" leftIcon={Download} onClick={() => setTemplatesOpen(true)}>
              Load
            </WaButton>
            <WaButton variant="outline" size="sm" leftIcon={Save} onClick={() => setSaveTemplateOpen(true)}>
              Save
            </WaButton>
            <WaButton variant="outline" size="sm" leftIcon={Copy} onClick={handleCopy}>
              Copy payload
            </WaButton>
            <WaButton size="sm" leftIcon={Send} onClick={() => setTestOpen(true)} disabled={!isValid}>
              Send test
            </WaButton>
          </>
        }
      />

      {/* KPI strip */}
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricTile label="Type" value={<span className="text-[14px] capitalize">{msgType.replace('_', ' ')}</span>} icon={Smartphone} delay={0.02} />
        <MetricTile label="Body chars" value={String(stats.charCount)} icon={MessageSquare} delay={0.05} />
        <MetricTile label="Buttons" value={String(stats.filledButtons)} icon={MessageSquare} delay={0.08} />
        <MetricTile label="List rows" value={String(stats.filledRows)} icon={ListIcon} delay={0.11} />
        <MetricTile label="Variables" value={String(stats.varCount)} icon={Variable} delay={0.14} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Message type
            </h2>
            <RadioGroup
              value={msgType}
              onValueChange={(v) => setMsgType(v as MsgType)}
              className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
            >
              {TYPE_OPTIONS.map((opt) => (
                <ZoruRadioCard
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  description={opt.desc}
                />
              ))}
            </RadioGroup>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <Label htmlFor="body-text" className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                Body text
              </Label>
              <span className="text-[10.5px] tabular-nums text-zinc-500">
                {stats.charCount} / 1024
              </span>
            </div>
            <Textarea
              id="body-text"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message body"
              className="min-h-[80px]"
            />
          </div>

          {msgType === 'buttons' && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Buttons (max 3)
                </h2>
                <span className="text-[10.5px] tabular-nums text-zinc-500">
                  {stats.filledButtons} / 3
                </span>
              </div>

              {/* Quick library */}
              <div className="mb-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 p-2.5">
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
                  Quick add
                </p>
                <div className="flex flex-wrap gap-1">
                  {QUICK_BUTTON_LIBRARY.flatMap((g) => g.items).slice(0, 8).map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => {
                        const emptyIdx = buttons.findIndex((b) => !b.label.trim());
                        if (emptyIdx === -1 && buttons.length >= 3) return;
                        if (emptyIdx === -1) setButtons((p) => [...p, { label: lbl, id: '' }]);
                        else updateButton(emptyIdx, { label: lbl });
                      }}
                      className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 active:scale-[0.97]"
                    >
                      + {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {buttons.map((btn, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-2.5">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
                      <span>Button {i + 1}</span>
                      <span className="ml-auto tabular-nums text-zinc-400">{btn.label.length}/20</span>
                    </div>
                    <Input
                      placeholder={`Button ${i + 1} label`}
                      value={btn.label}
                      onChange={(e) => updateButton(i, { label: e.target.value })}
                    />
                    <Input
                      placeholder="Postback / Flow ID (optional)"
                      value={btn.id}
                      onChange={(e) => updateButton(i, { id: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {msgType === 'list' && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Sections
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] tabular-nums text-zinc-500">
                    {sections.length} section · {stats.totalRows} row{stats.totalRows === 1 ? '' : 's'}
                  </span>
                  <WaButton variant="ghost" size="sm" onClick={addSection} leftIcon={Plus}>
                    Section
                  </WaButton>
                </div>
              </div>

              <div className="mb-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 p-2.5">
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
                  Quick templates
                </p>
                <div className="flex flex-wrap gap-1">
                  {LIST_TEMPLATE_LIBRARY.map((lt) => (
                    <button
                      key={lt.name}
                      type="button"
                      onClick={() => setSections(lt.sections)}
                      className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 active:scale-[0.97]"
                    >
                      + {lt.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {sections.map((sec, si) => (
                  <div key={si} className="rounded-lg border border-zinc-200 p-2.5">
                    <div className="mb-2 flex items-center gap-2">
                      <Input
                        placeholder="Section title (required)"
                        value={sec.title}
                        onChange={(e) => updateSection(si, e.target.value)}
                      />
                      <button
                        type="button"
                        aria-label="Remove section"
                        onClick={() => removeSection(si)}
                        className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.97]"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {sec.rows.map((row, ri) => (
                        <div
                          key={ri}
                          className="flex flex-col gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-2"
                        >
                          <div className="flex items-center gap-2">
                            <Input
                              className="flex-1"
                              placeholder="Row title (required)"
                              value={row.title}
                              onChange={(e) => updateRow(si, ri, { title: e.target.value })}
                            />
                            <button
                              type="button"
                              aria-label="Remove row"
                              onClick={() => removeRow(si, ri)}
                              className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-white hover:text-rose-600 active:scale-[0.97]"
                            >
                              <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                            </button>
                          </div>
                          <Input
                            placeholder="Description (optional)"
                            value={row.description}
                            onChange={(e) => updateRow(si, ri, { description: e.target.value })}
                          />
                          <Input
                            placeholder="Flow ID / Postback ID (optional)"
                            value={row.id || ''}
                            onChange={(e) => updateRow(si, ri, { id: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => addRow(si)}
                      className="mt-2 text-[11.5px] font-medium text-zinc-500 transition-colors hover:text-zinc-900"
                    >
                      + Add row
                    </button>
                  </div>
                ))}
                {sections.length === 0 && (
                  <p className="text-[12.5px] text-zinc-500">At least one section required.</p>
                )}
              </div>
            </div>
          )}

          {msgType === 'flow' && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                Flow configuration
              </h2>
              <div className="flex flex-col gap-3">
                <div className="space-y-1.5">
                  <Label>Flow ID (required)</Label>
                  <Input
                    value={flowId}
                    onChange={(e) => setFlowId(e.target.value)}
                    placeholder="e.g. 123456789"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Flow CTA button text</Label>
                  <Input
                    value={flowCta}
                    onChange={(e) => setFlowCta(e.target.value)}
                    placeholder="Open Flow"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Flow token (optional)</Label>
                  <Input
                    value={flowToken}
                    onChange={(e) => setFlowToken(e.target.value)}
                    placeholder="Optional token for flow"
                  />
                </div>
              </div>
            </div>
          )}

          {msgType === 'carousel' && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  Carousel cards
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] tabular-nums text-zinc-500">
                    {carouselCards.length} / 10
                  </span>
                  <WaButton variant="ghost" size="sm" onClick={addCard} leftIcon={Plus}>
                    Card
                  </WaButton>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {carouselCards.map((card, idx) => {
                  const isOpen = openCardIndex === idx;
                  return (
                    <div key={idx} className="overflow-hidden rounded-lg border border-zinc-200">
                      <button
                        type="button"
                        onClick={() => setOpenCardIndex(isOpen ? null : idx)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-50"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5 text-zinc-500" strokeWidth={2.25} aria-hidden />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-zinc-500" strokeWidth={2.25} aria-hidden />
                        )}
                        <span className="text-[12px] font-semibold text-zinc-900">
                          Card {idx + 1}
                          {card.title && <span className="ml-2 font-medium text-zinc-500">{card.title}</span>}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove card ${idx + 1}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCard(idx);
                          }}
                          className="ml-auto grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.97]"
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                        </button>
                      </button>
                      {isOpen && (
                        <div className="flex flex-col gap-2 border-t border-zinc-100 bg-zinc-50/50 p-2.5">
                          <Input
                            placeholder="Title"
                            value={card.title}
                            onChange={(e) => updateCard(idx, { title: e.target.value })}
                          />
                          <Input
                            placeholder="Description"
                            value={card.body}
                            onChange={(e) => updateCard(idx, { body: e.target.value })}
                          />
                          <Input
                            placeholder="Button label"
                            value={card.buttonLabel}
                            onChange={(e) => updateCard(idx, { buttonLabel: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {msgType === 'product' && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-[12.5px] text-zinc-600">
              <div className="flex items-center gap-2 text-zinc-900">
                <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden style={{ color: 'var(--mt-accent)' }} />
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em]">Catalog product</span>
              </div>
              <p className="mt-2">
                Product messages use your connected catalog. Configure products in the Catalog section.
              </p>
            </div>
          )}
          {msgType === 'location_request' && (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 text-[12.5px] text-zinc-600">
              <div className="flex items-center gap-2 text-zinc-900">
                <MapPin className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden style={{ color: 'var(--mt-accent)' }} />
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em]">Location request</span>
              </div>
              <p className="mt-2">This message will prompt the user to share their location.</p>
            </div>
          )}
        </div>

        {/* Right column: preview + validation */}
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <div className="space-y-3">
            <PhoneFrame title={activeProject?.name ?? 'Wachat Business'} subtitle="online">
              <AnimatePresence mode="popLayout" initial={false}>
                <m.div key="body" layout transition={{ duration: 0.25, ease: EASE_OUT }}>
                  <ChatBubble who="them" text={body || 'Message body'} time="12:00 PM" />
                </m.div>

                {msgType === 'buttons' && (
                  <m.div
                    key="buttons"
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                    className="space-y-1 pt-1"
                  >
                    {buttons
                      .filter((b) => b.label)
                      .map((l, i) => (
                        <div
                          key={i}
                          className="rounded-xl bg-white/95 px-3 py-1.5 text-center text-[11.5px] font-semibold text-emerald-700 shadow-sm"
                        >
                          {l.label}
                        </div>
                      ))}
                  </m.div>
                )}

                {msgType === 'list' && (
                  <m.div
                    key="list"
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                    className="space-y-1 pt-1"
                  >
                    <div className="rounded-xl bg-white/95 px-3 py-1.5 text-center text-[11.5px] font-semibold text-emerald-700 shadow-sm">
                      <ListIcon className="mr-1 inline h-3 w-3" strokeWidth={2.25} aria-hidden />
                      Menu
                    </div>
                    {sections.slice(0, 1).map((s, i) => (
                      <div key={i} className="space-y-0.5 rounded-xl bg-white/95 p-2 text-[10.5px] shadow-sm">
                        <p className="font-semibold text-zinc-900">{s.title || 'Section'}</p>
                        {s.rows.slice(0, 2).map((r, j) => (
                          <p key={j} className="text-zinc-600">· {r.title || 'Row'}</p>
                        ))}
                      </div>
                    ))}
                  </m.div>
                )}

                {msgType === 'location_request' && (
                  <m.div
                    key="loc"
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                    className="rounded-xl bg-white/95 px-3 py-1.5 text-center text-[11.5px] font-semibold text-emerald-700 shadow-sm"
                  >
                    <MapPin className="mr-1 inline h-3 w-3" strokeWidth={2.25} aria-hidden />
                    Send location
                  </m.div>
                )}

                {msgType === 'flow' && (
                  <m.div
                    key="flow"
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                    className="rounded-xl bg-white/95 px-3 py-1.5 text-center text-[11.5px] font-semibold text-emerald-700 shadow-sm"
                  >
                    {flowCta || 'Open Flow'}
                  </m.div>
                )}

                {msgType === 'carousel' && carouselCards.length > 0 && (
                  <m.div
                    key="carousel"
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                    className="space-y-1.5"
                  >
                    {carouselCards.slice(0, 1).map((c, i) => (
                      <div key={i} className="space-y-1 rounded-xl bg-white/95 p-2.5 shadow-sm">
                        <p className="text-[12px] font-semibold text-zinc-900">{c.title || 'Card title'}</p>
                        <p className="text-[11px] text-zinc-600">{c.body || 'Card body'}</p>
                        <div className="rounded-md bg-emerald-50 py-1 text-center text-[11px] font-semibold text-emerald-700">
                          {c.buttonLabel || 'Action'}
                        </div>
                      </div>
                    ))}
                    {carouselCards.length > 1 && (
                      <p className="text-center text-[10px] text-white/60">
                        +{carouselCards.length - 1} more
                      </p>
                    )}
                  </m.div>
                )}
              </AnimatePresence>
            </PhoneFrame>

            {/* Validation panel */}
            <div className="space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  <CircleCheck className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                  Validation
                </span>
                <span className="text-[10px] tabular-nums text-zinc-500">
                  {checks.filter((c) => c.ok).length} / {checks.length}
                </span>
              </div>
              <ul className="divide-y divide-zinc-100">
                {checks.map((c, i) => {
                  const Icon = c.ok ? CircleCheck : c.severity === 'error' ? CircleX : TriangleAlert;
                  const color = c.ok ? 'text-emerald-600' : c.severity === 'error' ? 'text-rose-600' : 'text-amber-600';
                  return (
                    <li key={i} className="flex items-start gap-2 py-1.5 text-[11.5px]">
                      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} strokeWidth={2.25} aria-hidden />
                      <span className={c.ok ? 'text-zinc-600' : 'text-zinc-900'}>{c.label}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center gap-2 border-t border-zinc-100 pt-2 text-[11px]">
                {errors > 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
                    <CircleX className="h-3 w-3" strokeWidth={2.25} aria-hidden /> {errors} blocking
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                    <CircleCheck className="h-3 w-3" strokeWidth={2.25} aria-hidden /> Ready
                  </span>
                )}
                {warnings > 0 && (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                    <TriangleAlert className="h-3 w-3" strokeWidth={2.25} aria-hidden /> {warnings} warn
                  </span>
                )}
              </div>
            </div>

            {/* Saved templates summary */}
            {savedTemplates.length > 0 && (
              <button
                type="button"
                onClick={() => setTemplatesOpen(true)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left text-[11.5px] transition-colors hover:border-zinc-900 hover:bg-zinc-50"
              >
                <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-900">
                  <Pin className="h-3 w-3" strokeWidth={2.25} aria-hidden /> {savedTemplates.length} saved layout{savedTemplates.length > 1 ? 's' : ''}
                </span>
                <ChevronRight className="h-3 w-3 text-zinc-500" strokeWidth={2.25} aria-hidden />
              </button>
            )}
          </div>
        </aside>
      </div>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Send test message</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter a WhatsApp number to deliver the current interactive payload for verification.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="test-number">Phone number</Label>
            <Input
              id="test-number"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="+1 234 567 890"
            />
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendTest}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> Send test
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Save template</ZoruDialogTitle>
            <ZoruDialogDescription>
              Save this interactive message layout for future use.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>Template name</Label>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Support menu"
            />
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Load template</ZoruDialogTitle>
            <ZoruDialogDescription>
              Choose a saved template to load into the builder.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
            {savedTemplates.length === 0 ? (
              <p className="text-[13px] text-zinc-500">No saved templates found.</p>
            ) : (
              savedTemplates.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-2.5"
                >
                  <div>
                    <p className="text-[13px] font-medium text-zinc-900">{t.name}</p>
                    <p className="text-[11px] capitalize text-zinc-500">
                      {(t.state.msgType ?? 'buttons').replace('_', ' ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => loadState(t.state)}>
                      Load
                    </Button>
                    <button
                      type="button"
                      aria-label="Delete saved template"
                      onClick={() => handleDeleteTemplate(i)}
                      className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.97]"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setTemplatesOpen(false)}>
              Close
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Quick library dialog */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Quick library</ZoruDialogTitle>
            <ZoruDialogDescription>
              Common button labels and list templates. Click any to insert.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="max-h-[400px] space-y-3 overflow-y-auto">
            {QUICK_BUTTON_LIBRARY.map((group) => (
              <div key={group.group}>
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  {group.group} buttons
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => {
                        setMsgType('buttons');
                        const emptyIdx = buttons.findIndex((b) => !b.label.trim());
                        if (emptyIdx === -1 && buttons.length >= 3) return;
                        if (emptyIdx === -1) setButtons((p) => [...p, { label: lbl, id: '' }]);
                        else updateButton(emptyIdx, { label: lbl });
                      }}
                      className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 active:scale-[0.97]"
                    >
                      + {lbl}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                List templates
              </p>
              <div className="flex flex-wrap gap-1.5">
                {LIST_TEMPLATE_LIBRARY.map((lt) => (
                  <button
                    key={lt.name}
                    type="button"
                    onClick={() => {
                      setMsgType('list');
                      setSections(lt.sections);
                      setLibraryOpen(false);
                    }}
                    className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 active:scale-[0.97]"
                  >
                    + {lt.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setLibraryOpen(false)}>
              Close
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}
