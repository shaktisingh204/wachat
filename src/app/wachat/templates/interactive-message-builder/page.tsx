'use client';

import {
  Button,
  IconButton,
  Card,
  Modal,
  Input,
  Field,
  RadioGroup,
  Radio,
  Textarea,
  EmptyState,
  useToast,
} from '@/components/sabcrm/20ui';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, Copy, Send, Save, Download } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
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
  const { toast } = useToast();

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
      toast({ title: 'Template name required', tone: 'danger' });
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
      toast({ title: 'Validation error', description: 'Please fill out all required fields properly.', tone: 'danger' });
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
      toast({ title: 'Validation error', description: 'Please fill out all required fields properly.', tone: 'danger' });
      return;
    }
    if (!testNumber.trim()) {
      toast({
        title: 'Phone number required',
        description: 'Enter a recipient WhatsApp number to test send.',
        tone: 'danger',
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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Templates', href: '/wachat/templates' },
        { label: 'Interactive Messages' },
      ]}
      eyebrow={`WaChat · ${activeProject?.name ?? 'Project'}`}
      title="Interactive Messages"
      description="Build interactive WhatsApp messages with buttons, lists, and more."
      actions={
        <>
          <Button variant="outline" iconLeft={Download} onClick={() => setTemplatesOpen(true)}>
            Load template
          </Button>
          <Button variant="outline" iconLeft={Save} onClick={() => setSaveTemplateOpen(true)}>
            Save template
          </Button>
          <Button variant="outline" iconLeft={Copy} onClick={handleCopy}>
            Copy payload
          </Button>
          <Button variant="primary" iconLeft={Send} onClick={() => setTestOpen(true)}>
            Send test
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Card padding="lg">
            <div className="flex flex-col gap-3">
              <h2 className="text-[15px]" style={{ color: 'var(--st-text)' }}>Message type</h2>
              <RadioGroup
                value={msgType}
                onValueChange={(v) => setMsgType(v as MsgType)}
                aria-label="Message type"
                className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <Radio
                    key={opt.value}
                    value={opt.value}
                    label={
                      <span className="flex flex-col">
                        <span style={{ color: 'var(--st-text)' }}>{opt.label}</span>
                        <span className="text-[12px]" style={{ color: 'var(--st-text-tertiary)' }}>
                          {opt.desc}
                        </span>
                      </span>
                    }
                  />
                ))}
              </RadioGroup>
            </div>
          </Card>

          <Card padding="lg">
            <Field label="Body text">
              <Textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message body…"
                className="min-h-[80px]"
              />
            </Field>
          </Card>

          {msgType === 'buttons' && (
            <Card padding="lg">
              <div className="flex flex-col gap-3">
                <h2 className="text-[15px]" style={{ color: 'var(--st-text)' }}>Buttons (max 3)</h2>
                <div className="flex flex-col gap-3">
                  {buttons.map((btn, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-2 p-3"
                      style={{ border: '1px solid var(--st-border)', borderRadius: 'var(--st-radius)' }}
                    >
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
            <Card padding="lg">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px]" style={{ color: 'var(--st-text)' }}>Sections</h2>
                <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addSection}>
                  Section
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                {sections.map((sec, si) => (
                  <div
                    key={si}
                    className="p-3"
                    style={{ border: '1px solid var(--st-border)', borderRadius: 'var(--st-radius)' }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Input
                        placeholder="Section title (required)"
                        value={sec.title}
                        onChange={(e) => updateSection(si, e.target.value)}
                        invalid={!sec.title.trim()}
                      />
                      <IconButton
                        variant="ghost"
                        size="sm"
                        label="Remove section"
                        icon={Trash2}
                        onClick={() => removeSection(si)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {sec.rows.map((row, ri) => (
                        <div
                          key={ri}
                          className="flex flex-col gap-2 p-2"
                          style={{
                            border: '1px solid var(--st-border)',
                            borderRadius: 'var(--st-radius)',
                            background: 'var(--st-bg-secondary)',
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <Input
                              className="flex-1"
                              placeholder="Row title (required)"
                              value={row.title}
                              onChange={(e) => updateRow(si, ri, { title: e.target.value })}
                              invalid={!row.title.trim()}
                            />
                            <IconButton
                              variant="ghost"
                              size="sm"
                              label="Remove row"
                              icon={Trash2}
                              onClick={() => removeRow(si, ri)}
                            />
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
                      className="mt-2 text-[11px] transition-colors"
                      style={{ color: 'var(--st-text-tertiary)' }}
                    >
                      + Add row
                    </button>
                  </div>
                ))}
                {sections.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--st-text)' }}>At least one section required.</p>
                )}
              </div>
            </Card>
          )}

          {msgType === 'flow' && (
            <Card padding="lg">
              <div className="flex flex-col gap-3">
                <h2 className="text-[15px]" style={{ color: 'var(--st-text)' }}>Flow Configuration</h2>
                <div className="flex flex-col gap-2">
                  <Field label="Flow ID (required)">
                    <Input
                      value={flowId}
                      onChange={e => setFlowId(e.target.value)}
                      placeholder="e.g. 123456789"
                      invalid={!flowId.trim()}
                    />
                  </Field>

                  <Field label="Flow CTA Button Text">
                    <Input
                      value={flowCta}
                      onChange={e => setFlowCta(e.target.value)}
                      placeholder="Open Flow"
                    />
                  </Field>

                  <Field label="Flow Token (optional)">
                    <Input
                      value={flowToken}
                      onChange={e => setFlowToken(e.target.value)}
                      placeholder="Optional token for flow"
                    />
                  </Field>
                </div>
              </div>
            </Card>
          )}

          {msgType === 'carousel' && (
            <Card padding="lg">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px]" style={{ color: 'var(--st-text)' }}>Carousel Cards</h2>
                <Button variant="ghost" size="sm" iconLeft={Plus} onClick={addCard}>
                  Card
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                {carouselCards.map((card, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 p-3"
                    style={{ border: '1px solid var(--st-border)', borderRadius: 'var(--st-radius)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium" style={{ color: 'var(--st-text)' }}>
                        Card {idx + 1}
                      </span>
                      <IconButton variant="ghost" size="sm" label="Remove card" icon={Trash2} onClick={() => removeCard(idx)} />
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
            <Card padding="lg">
              <p className="text-[13px]" style={{ color: 'var(--st-text-secondary)' }}>
                Product messages use your connected catalog. Configure products
                in the Catalog section.
              </p>
            </Card>
          )}
          {msgType === 'location_request' && (
            <Card padding="lg">
              <p className="text-[13px]" style={{ color: 'var(--st-text-secondary)' }}>
                This message will prompt the user to share their location.
              </p>
            </Card>
          )}
        </div>

        <Card padding="lg" className="sticky top-6 self-start">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4" style={{ color: 'var(--st-text-tertiary)' }} aria-hidden="true" />
            <h2 className="text-[15px]" style={{ color: 'var(--st-text)' }}>Preview</h2>
          </div>
          <div className="p-4" style={{ background: 'var(--st-bg-secondary)', borderRadius: 'var(--st-radius)' }}>
            <div
              className="max-w-[260px] p-3 overflow-hidden"
              style={{ background: 'var(--st-bg)', borderRadius: 'var(--st-radius)', boxShadow: 'var(--st-shadow-sm)' }}
            >
              <p className="whitespace-pre-wrap text-[13px]" style={{ color: 'var(--st-text)' }}>
                {body || 'Message body…'}
              </p>
              {msgType === 'buttons' && (
                <div className="mt-2 flex flex-col gap-1 pt-2" style={{ borderTop: '1px solid var(--st-border)' }}>
                  {buttons.filter(b => b.label).map((l, i) => (
                    <div
                      key={i}
                      className="py-1 text-center text-[12px]"
                      style={{ border: '1px solid var(--st-border)', borderRadius: 'var(--st-radius)', color: 'var(--st-text)' }}
                    >
                      {l.label}
                    </div>
                  ))}
                </div>
              )}
              {msgType === 'list' && (
                <div className="mt-2 pt-2 text-center text-[12px]" style={{ borderTop: '1px solid var(--st-border)', color: 'var(--st-text)' }}>
                  Menu
                </div>
              )}
              {msgType === 'location_request' && (
                <div className="mt-2 pt-2 text-center text-[12px]" style={{ borderTop: '1px solid var(--st-border)', color: 'var(--st-text)' }}>
                  Send Location
                </div>
              )}
              {msgType === 'flow' && (
                <div className="mt-2 pt-2 text-center text-[12px]" style={{ borderTop: '1px solid var(--st-border)', color: 'var(--st-text)' }}>
                  {flowCta || 'Open Flow'}
                </div>
              )}
              {msgType === 'carousel' && carouselCards.length > 0 && (
                <div className="mt-2 pt-2 flex flex-col gap-2" style={{ borderTop: '1px solid var(--st-border)' }}>
                  {carouselCards.slice(0, 1).map((c, i) => (
                    <div
                      key={i}
                      className="p-2 flex flex-col gap-1"
                      style={{ border: '1px solid var(--st-border)', borderRadius: 'var(--st-radius)' }}
                    >
                      <p className="text-[12px] font-medium" style={{ color: 'var(--st-text)' }}>{c.title || 'Card Title'}</p>
                      <p className="text-[11px]" style={{ color: 'var(--st-text-secondary)' }}>{c.body || 'Card Body'}</p>
                      <div className="mt-1 pt-1 text-center text-[11px]" style={{ borderTop: '1px solid var(--st-border)', color: 'var(--st-text)' }}>
                        {c.buttonLabel || 'Action'}
                      </div>
                    </div>
                  ))}
                  {carouselCards.length > 1 && (
                    <p className="text-[10px] text-center" style={{ color: 'var(--st-text-secondary)' }}>+{carouselCards.length - 1} more</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        title="Send test message"
        description="Enter a WhatsApp number to deliver the current interactive payload for verification."
        footer={
          <>
            <Button variant="outline" onClick={() => setTestOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" iconLeft={Send} onClick={handleSendTest}>
              Send test
            </Button>
          </>
        }
      >
        <Field label="Phone number">
          <Input
            value={testNumber}
            onChange={(e) => setTestNumber(e.target.value)}
            placeholder="+1 234 567 890"
          />
        </Field>
      </Modal>

      <Modal
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        title="Save Template"
        description="Save this interactive message layout for future use."
        footer={
          <>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" iconLeft={Save} onClick={handleSaveTemplate}>
              Save
            </Button>
          </>
        }
      >
        <Field label="Template Name">
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g. Support Menu"
          />
        </Field>
      </Modal>

      <Modal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        title="Load Template"
        description="Choose a saved template to load into the builder."
        footer={
          <Button variant="outline" onClick={() => setTemplatesOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
          {savedTemplates.length === 0 ? (
            <EmptyState
              title="No saved templates"
              description="Saved interactive message layouts will appear here."
            />
          ) : (
            savedTemplates.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2"
                style={{ border: '1px solid var(--st-border)', borderRadius: 'var(--st-radius)' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--st-text)' }}>{t.name}</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadState(t.state)}>
                    Load
                  </Button>
                  <IconButton size="sm" variant="ghost" label="Delete template" icon={Trash2} onClick={() => handleDeleteTemplate(i)} />
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </WachatPage>
  );
}
