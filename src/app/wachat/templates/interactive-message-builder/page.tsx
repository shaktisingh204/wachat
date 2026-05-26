'use client';

import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruRadioCard,
  RadioGroup,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, Copy, Send, Save, Download } from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  MsgType,
  ListSection,
  ListRow,
  CarouselCard,
  InteractiveMessageState,
  InteractiveButton,
  buildInteractivePayload
} from './utils';

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
  
  const [msgType, setMsgType] = useState<MsgType>('buttons');
  const [body, setBody] = useState('Please choose an option below:');
  const [buttons, setButtons] = useState<InteractiveButton[]>([
    { label: 'Option A', id: '' },
    { label: 'Option B', id: '' },
    { label: '', id: '' }
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
    { title: 'Card 1', body: 'Description 1', buttonLabel: 'Action 1' }
  ]);

  const [testOpen, setTestOpen] = useState(false);
  const [testNumber, setTestNumber] = useState('');

  // Templates State
  const [templateName, setTemplateName] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<{name: string, state: InteractiveMessageState}[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('wachat_interactive_templates');
      if (stored) setSavedTemplates(JSON.parse(stored));
    } catch(e) {}
  }, []);

  const getState = (): InteractiveMessageState => ({
    msgType,
    body,
    buttons,
    sections,
    flowId,
    flowCta,
    flowToken,
    carouselCards
  });

  const loadState = (s: InteractiveMessageState) => {
    setMsgType(s.msgType || 'buttons');
    setBody(s.body || '');
    setButtons(s.buttons || [{label: '', id: ''}]);
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
  const removeSection = (i: number) =>
    setSections((p) => p.filter((_, idx) => idx !== i));
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
          ? {
              ...s,
              rows: s.rows.map((r, j) => (j === ri ? { ...r, ...patch } : r)),
            }
          : s,
      ),
    );
  };
  const removeRow = (si: number, ri: number) =>
    setSections((p) =>
      p.map((s, idx) =>
        idx === si ? { ...s, rows: s.rows.filter((_, j) => j !== ri) } : s,
      ),
    );

  const addCard = () => {
    setCarouselCards((p) => [...p, { title: '', body: '', buttonLabel: '' }]);
  };
  const updateCard = (i: number, patch: Partial<CarouselCard>) => {
    setCarouselCards((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };
  const removeCard = (i: number) => {
    setCarouselCards((p) => p.filter((_, idx) => idx !== i));
  };

  const handleCopy = async () => {
    if (!validateState()) {
      toast({ title: 'Validation error', description: 'Please fill out all required fields properly.', variant: 'destructive' });
      return;
    }
    const payload = buildInteractivePayload(getState());
    const json = JSON.stringify(payload, null, 2);
    await navigator.clipboard.writeText(json);
    toast({
      title: 'Copied to clipboard',
      description: 'Interactive message JSON payload copied.',
    });
  };

  const handleSendTest = async () => {
    if (!validateState()) {
      toast({ title: 'Validation error', description: 'Please fill out all required fields properly.', variant: 'destructive' });
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
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat/templates">Templates</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Interactive Messages</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageEyebrow>
            WaChat · {activeProject?.name ?? 'Project'}
          </ZoruPageEyebrow>
          <ZoruPageTitle>Interactive Messages</ZoruPageTitle>
          <ZoruPageDescription>
            Build interactive WhatsApp messages with buttons, lists, and more.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
            <Download /> Load template
          </Button>
          <Button variant="outline" onClick={() => setSaveTemplateOpen(true)}>
            <Save /> Save template
          </Button>
          <Button variant="outline" onClick={handleCopy}>
            <Copy /> Copy payload
          </Button>
          <Button onClick={() => setTestOpen(true)}>
            <Send /> Send test
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex flex-col gap-3">
              <h2 className="text-[15px] text-zoru-ink">Message type</h2>
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
          </Card>

          <Card className="p-5">
            <div className="flex flex-col gap-3">
              <Label htmlFor="body-text">Body text</Label>
              <Textarea
                id="body-text"
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message body…"
                className="min-h-[80px]"
              />
            </div>
          </Card>

          {msgType === 'buttons' && (
            <Card className="p-5">
              <div className="flex flex-col gap-3">
                <h2 className="text-[15px] text-zoru-ink">Buttons (max 3)</h2>
                <div className="flex flex-col gap-3">
                  {buttons.map((btn, i) => (
                    <div key={i} className="flex flex-col gap-2 rounded border border-zoru-line p-3">
                      <Input
                        placeholder={`Button ${i + 1} label`}
                        value={btn.label}
                        onChange={(e) => updateButton(i, { label: e.target.value })}
                      />
                      <Input
                        placeholder={`Postback / Flow ID (optional)`}
                        value={btn.id}
                        onChange={(e) => updateButton(i, { id: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {msgType === 'list' && (
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] text-zoru-ink">Sections</h2>
                <Button variant="ghost" size="sm" onClick={addSection}>
                  <Plus /> Section
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                {sections.map((sec, si) => (
                  <div
                    key={si}
                    className="rounded-[var(--zoru-radius)] border border-zoru-line p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Input
                        placeholder="Section title (required)"
                        value={sec.title}
                        onChange={(e) => updateSection(si, e.target.value)}
                        className={!sec.title.trim() ? "border-red-500" : ""}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove section"
                        onClick={() => removeSection(si)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {sec.rows.map((row, ri) => (
                        <div key={ri} className="flex flex-col gap-2 rounded border border-zoru-line bg-zoru-surface-2 p-2">
                          <div className="flex items-center gap-2">
                            <Input
                              className={`flex-1 ${!row.title.trim() ? "border-red-500" : ""}`}
                              placeholder="Row title (required)"
                              value={row.title}
                              onChange={(e) => updateRow(si, ri, { title: e.target.value })}
                            />
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Remove row"
                              onClick={() => removeRow(si, ri)}
                            >
                              <Trash2 />
                            </Button>
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
                      className="mt-2 text-[11px] text-zoru-ink-muted transition-colors hover:text-zoru-ink"
                    >
                      + Add row
                    </button>
                  </div>
                ))}
                {sections.length === 0 && <p className="text-sm text-red-500">At least one section required.</p>}
              </div>
            </Card>
          )}

          {msgType === 'flow' && (
            <Card className="p-5">
              <div className="flex flex-col gap-3">
                <h2 className="text-[15px] text-zoru-ink">Flow Configuration</h2>
                <div className="flex flex-col gap-2">
                  <Label>Flow ID (required)</Label>
                  <Input 
                    value={flowId} 
                    onChange={e => setFlowId(e.target.value)} 
                    placeholder="e.g. 123456789"
                    className={!flowId.trim() ? "border-red-500" : ""}
                  />
                  
                  <Label>Flow CTA Button Text</Label>
                  <Input 
                    value={flowCta} 
                    onChange={e => setFlowCta(e.target.value)} 
                    placeholder="Open Flow"
                  />
                  
                  <Label>Flow Token (optional)</Label>
                  <Input 
                    value={flowToken} 
                    onChange={e => setFlowToken(e.target.value)} 
                    placeholder="Optional token for flow"
                  />
                </div>
              </div>
            </Card>
          )}
          
          {msgType === 'carousel' && (
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] text-zoru-ink">Carousel Cards</h2>
                <Button variant="ghost" size="sm" onClick={addCard}>
                  <Plus /> Card
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                {carouselCards.map((card, idx) => (
                  <div key={idx} className="flex flex-col gap-2 rounded border border-zoru-line p-3">
                    <div className="flex items-center justify-between">
                      <Label>Card {idx + 1}</Label>
                      <Button variant="ghost" size="icon-sm" onClick={() => removeCard(idx)}>
                        <Trash2 />
                      </Button>
                    </div>
                    <Input 
                      placeholder="Title"
                      value={card.title}
                      onChange={e => updateCard(idx, { title: e.target.value })}
                    />
                    <Input 
                      placeholder="Description"
                      value={card.body}
                      onChange={e => updateCard(idx, { body: e.target.value })}
                    />
                    <Input 
                      placeholder="Button Label"
                      value={card.buttonLabel}
                      onChange={e => updateCard(idx, { buttonLabel: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {msgType === 'product' && (
            <Card className="p-5">
              <p className="text-[13px] text-zoru-ink-muted">
                Product messages use your connected catalog. Configure products
                in the Catalog section.
              </p>
            </Card>
          )}
          {msgType === 'location_request' && (
            <Card className="p-5">
              <p className="text-[13px] text-zoru-ink-muted">
                This message will prompt the user to share their location.
              </p>
            </Card>
          )}
        </div>

        <Card className="sticky top-6 self-start p-5">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-zoru-ink-muted" />
            <h2 className="text-[15px] text-zoru-ink">Preview</h2>
          </div>
          <div className="rounded-[var(--zoru-radius)] bg-zoru-surface-2 p-4">
            <div className="max-w-[260px] rounded-[var(--zoru-radius)] bg-zoru-bg p-3 shadow-[var(--zoru-shadow-sm)] overflow-hidden">
              <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
                {body || 'Message body…'}
              </p>
              {msgType === 'buttons' && (
                <div className="mt-2 flex flex-col gap-1 border-t border-zoru-line pt-2">
                  {buttons.filter(b => b.label).map((l, i) => (
                    <div
                      key={i}
                      className="rounded-[var(--zoru-radius-sm)] border border-zoru-line py-1 text-center text-[12px] text-zoru-ink"
                    >
                      {l.label}
                    </div>
                  ))}
                </div>
              )}
              {msgType === 'list' && (
                <div className="mt-2 border-t border-zoru-line pt-2 text-center text-[12px] text-zoru-ink">
                  Menu
                </div>
              )}
              {msgType === 'location_request' && (
                <div className="mt-2 border-t border-zoru-line pt-2 text-center text-[12px] text-zoru-ink">
                  Send Location
                </div>
              )}
              {msgType === 'flow' && (
                <div className="mt-2 border-t border-zoru-line pt-2 text-center text-[12px] text-zoru-ink">
                  {flowCta || 'Open Flow'}
                </div>
              )}
              {msgType === 'carousel' && carouselCards.length > 0 && (
                <div className="mt-2 border-t border-zoru-line pt-2 flex flex-col gap-2">
                  {carouselCards.slice(0, 1).map((c, i) => (
                    <div key={i} className="border border-zoru-line rounded p-2 flex flex-col gap-1">
                      <p className="text-[12px] font-medium">{c.title || 'Card Title'}</p>
                      <p className="text-[11px] text-zoru-ink-muted">{c.body || 'Card Body'}</p>
                      <div className="mt-1 border-t border-zoru-line pt-1 text-center text-[11px] text-blue-500">
                        {c.buttonLabel || 'Action'}
                      </div>
                    </div>
                  ))}
                  {carouselCards.length > 1 && (
                    <p className="text-[10px] text-center text-zoru-ink-muted">+{carouselCards.length - 1} more</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Send test message</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter a WhatsApp number to deliver the current interactive payload
              for verification.
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
              <Send /> Send test
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Save Template</ZoruDialogTitle>
            <ZoruDialogDescription>
              Save this interactive message layout for future use.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label>Template Name</Label>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Support Menu"
            />
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>
              <Save /> Save
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Load Template</ZoruDialogTitle>
            <ZoruDialogDescription>
              Choose a saved template to load into the builder.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
            {savedTemplates.length === 0 ? (
              <p className="text-sm text-zoru-ink-muted">No saved templates found.</p>
            ) : (
              savedTemplates.map((t, i) => (
                <div key={i} className="flex items-center justify-between p-2 border border-zoru-line rounded">
                  <span className="text-sm font-medium">{t.name}</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => loadState(t.state)}>
                      Load
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => handleDeleteTemplate(i)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
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
    </div>
  );
}
