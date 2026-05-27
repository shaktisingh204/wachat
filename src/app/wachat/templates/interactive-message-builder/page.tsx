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
import { useState, useEffect } from 'react';
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
} from '@/components/wachat-ui';

const TYPE_OPTIONS: { value: MsgType; label: string; desc: string }[] = [
  { value: 'buttons', label: 'Buttons', desc: 'Up to 3 reply buttons' },
  { value: 'list', label: 'List menu', desc: 'Sectioned options menu' },
  { value: 'product', label: 'Product', desc: 'Catalog-driven product card' },
  { value: 'location_request', label: 'Location request', desc: 'Ask the user to share location' },
  { value: 'flow', label: 'Flow', desc: 'Trigger a WhatsApp Flow' },
  { value: 'carousel', label: 'Carousel', desc: 'Scrollable cards' },
];

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

  return (
    <WaPage>
      <PageHeader
        title="Interactive messages"
        description="Build interactive WhatsApp messages with buttons, lists, flows, and more."
        kicker={`Wachat · ${activeProject?.name ?? 'project'}`}
        backHref="/wachat/templates"
        eyebrowIcon={Smartphone}
        actions={
          <>
            <WaButton variant="outline" size="sm" leftIcon={Download} onClick={() => setTemplatesOpen(true)}>
              Load
            </WaButton>
            <WaButton variant="outline" size="sm" leftIcon={Save} onClick={() => setSaveTemplateOpen(true)}>
              Save
            </WaButton>
            <WaButton variant="outline" size="sm" leftIcon={Copy} onClick={handleCopy}>
              Copy payload
            </WaButton>
            <WaButton size="sm" leftIcon={Send} onClick={() => setTestOpen(true)}>
              Send test
            </WaButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-3 text-[13px] font-semibold tracking-tight text-zinc-900">
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

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <Label htmlFor="body-text" className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Body text
            </Label>
            <Textarea
              id="body-text"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message body"
              className="mt-2 min-h-[80px]"
            />
          </div>

          {msgType === 'buttons' && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="mb-3 text-[13px] font-semibold tracking-tight text-zinc-900">
                Buttons (max 3)
              </h2>
              <div className="flex flex-col gap-3">
                {buttons.map((btn, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3">
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
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold tracking-tight text-zinc-900">Sections</h2>
                <WaButton variant="ghost" size="sm" onClick={addSection} leftIcon={Plus}>
                  Section
                </WaButton>
              </div>
              <div className="flex flex-col gap-3">
                {sections.map((sec, si) => (
                  <div key={si} className="rounded-xl border border-zinc-200 p-3">
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
                          className="flex flex-col gap-2 rounded-xl border border-zinc-100 bg-zinc-50 p-2"
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
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="mb-3 text-[13px] font-semibold tracking-tight text-zinc-900">
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
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold tracking-tight text-zinc-900">
                  Carousel cards
                </h2>
                <WaButton variant="ghost" size="sm" onClick={addCard} leftIcon={Plus}>
                  Card
                </WaButton>
              </div>
              <div className="flex flex-col gap-3">
                {carouselCards.map((card, idx) => (
                  <div key={idx} className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3">
                    <div className="flex items-center justify-between">
                      <Label>Card {idx + 1}</Label>
                      <button
                        type="button"
                        aria-label={`Remove card ${idx + 1}`}
                        onClick={() => removeCard(idx)}
                        className="grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-rose-600 active:scale-[0.97]"
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={2.25} />
                      </button>
                    </div>
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
                ))}
              </div>
            </div>
          )}

          {msgType === 'product' && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-[13px] text-zinc-600">
              Product messages use your connected catalog. Configure products in the Catalog section.
            </div>
          )}
          {msgType === 'location_request' && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-[13px] text-zinc-600">
              This message will prompt the user to share their location.
            </div>
          )}
        </div>

        {/* Preview */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
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
                  className="rounded-xl bg-white/95 px-3 py-1.5 text-center text-[11.5px] font-semibold text-emerald-700 shadow-sm"
                >
                  Menu
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
                    <div
                      key={i}
                      className="space-y-1 rounded-xl bg-white/95 p-2.5 shadow-sm"
                    >
                      <p className="text-[12px] font-semibold text-zinc-900">
                        {c.title || 'Card title'}
                      </p>
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
                  className="flex items-center justify-between rounded-xl border border-zinc-200 p-2.5"
                >
                  <span className="text-[13px] font-medium text-zinc-900">{t.name}</span>
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
    </WaPage>
  );
}
