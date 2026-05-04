'use client';

/**
 * /wachat/interactive-messages — build interactive WhatsApp messages
 * with buttons / lists / location / product. Send-test dialog copies
 * payload to clipboard.
 */

import * as React from 'react';
import { useState } from 'react';
import { Plus, Trash2, Eye, Copy, Send } from 'lucide-react';

import { useProject } from '@/context/project-context';

import {
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruRadioCard,
  ZoruRadioGroup,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';

type MsgType = 'buttons' | 'list' | 'product' | 'location_request';
interface ListRow {
  title: string;
  description: string;
}
interface ListSection {
  title: string;
  rows: ListRow[];
}

const TYPE_OPTIONS: { value: MsgType; label: string; desc: string }[] = [
  { value: 'buttons', label: 'Buttons', desc: 'Up to 3 reply buttons' },
  { value: 'list', label: 'List menu', desc: 'Sectioned options menu' },
  { value: 'product', label: 'Product', desc: 'Catalog-driven product card' },
  {
    value: 'location_request',
    label: 'Location request',
    desc: 'Ask the user to share location',
  },
];

export default function InteractiveMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [msgType, setMsgType] = useState<MsgType>('buttons');
  const [body, setBody] = useState('Please choose an option below:');
  const [buttonLabels, setButtonLabels] = useState(['Option A', 'Option B', '']);
  const [sections, setSections] = useState<ListSection[]>([
    {
      title: 'Main Menu',
      rows: [
        { title: 'Sales', description: 'Talk to sales' },
        { title: 'Support', description: 'Get help' },
      ],
    },
  ]);
  const [testOpen, setTestOpen] = useState(false);
  const [testNumber, setTestNumber] = useState('');

  const updateButton = (i: number, val: string) =>
    setButtonLabels((prev) => prev.map((b, idx) => (idx === i ? val : b)));
  const addSection = () =>
    setSections((p) => [...p, { title: '', rows: [{ title: '', description: '' }] }]);
  const removeSection = (i: number) =>
    setSections((p) => p.filter((_, idx) => idx !== i));
  const updateSection = (i: number, title: string) =>
    setSections((p) => p.map((s, idx) => (idx === i ? { ...s, title } : s)));
  const addRow = (si: number) =>
    setSections((p) =>
      p.map((s, idx) =>
        idx === si
          ? { ...s, rows: [...s.rows, { title: '', description: '' }] }
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

  const buildPayload = () => {
    const payload: any = {
      type: 'interactive',
      interactive: { type: msgType, body: { text: body } },
    };
    if (msgType === 'buttons') {
      payload.interactive.action = {
        buttons: buttonLabels
          .filter(Boolean)
          .map((l, i) => ({ type: 'reply', reply: { id: `btn_${i}`, title: l } })),
      };
    } else if (msgType === 'list') {
      payload.interactive.action = {
        button: 'Menu',
        sections: sections.map((s) => ({
          title: s.title,
          rows: s.rows.map((r, i) => ({
            id: `row_${i}`,
            title: r.title,
            description: r.description,
          })),
        })),
      };
    } else if (msgType === 'location_request') {
      payload.interactive.action = { name: 'send_location' };
    }
    return payload;
  };

  const handleCopy = async () => {
    const json = JSON.stringify(buildPayload(), null, 2);
    await navigator.clipboard.writeText(json);
    toast({
      title: 'Copied to clipboard',
      description: 'Interactive message JSON payload copied.',
    });
  };

  const handleSendTest = async () => {
    if (!testNumber.trim()) {
      toast({
        title: 'Phone number required',
        description: 'Enter a recipient WhatsApp number to test send.',
        variant: 'destructive',
      });
      return;
    }
    const json = JSON.stringify(buildPayload(), null, 2);
    await navigator.clipboard.writeText(json);
    toast({
      title: 'Test prepared',
      description: `Payload copied. Send to ${testNumber} via your test panel.`,
    });
    setTestOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbPage>Interactive Messages</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
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
          <ZoruButton variant="outline" onClick={handleCopy}>
            <Copy /> Copy payload
          </ZoruButton>
          <ZoruButton onClick={() => setTestOpen(true)}>
            <Send /> Send test
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <ZoruCard className="p-5">
            <div className="flex flex-col gap-3">
              <h2 className="text-[15px] text-zoru-ink">Message type</h2>
              <ZoruRadioGroup
                value={msgType}
                onValueChange={(v) => setMsgType(v as MsgType)}
                className="grid gap-2 sm:grid-cols-2"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <ZoruRadioCard
                    key={opt.value}
                    value={opt.value}
                    label={opt.label}
                    description={opt.desc}
                  />
                ))}
              </ZoruRadioGroup>
            </div>
          </ZoruCard>

          <ZoruCard className="p-5">
            <div className="flex flex-col gap-3">
              <ZoruLabel htmlFor="body-text">Body text</ZoruLabel>
              <ZoruTextarea
                id="body-text"
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message body…"
                className="min-h-[80px]"
              />
            </div>
          </ZoruCard>

          {msgType === 'buttons' && (
            <ZoruCard className="p-5">
              <div className="flex flex-col gap-3">
                <h2 className="text-[15px] text-zoru-ink">Buttons (max 3)</h2>
                <div className="flex flex-col gap-2">
                  {buttonLabels.map((label, i) => (
                    <ZoruInput
                      key={i}
                      placeholder={`Button ${i + 1} label`}
                      value={label}
                      onChange={(e) => updateButton(i, e.target.value)}
                    />
                  ))}
                </div>
              </div>
            </ZoruCard>
          )}

          {msgType === 'list' && (
            <ZoruCard className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[15px] text-zoru-ink">Sections</h2>
                <ZoruButton variant="ghost" size="sm" onClick={addSection}>
                  <Plus /> Section
                </ZoruButton>
              </div>
              <div className="flex flex-col gap-3">
                {sections.map((sec, si) => (
                  <div
                    key={si}
                    className="rounded-[var(--zoru-radius)] border border-zoru-line p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <ZoruInput
                        placeholder="Section title"
                        value={sec.title}
                        onChange={(e) => updateSection(si, e.target.value)}
                      />
                      <ZoruButton
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove section"
                        onClick={() => removeSection(si)}
                      >
                        <Trash2 />
                      </ZoruButton>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {sec.rows.map((row, ri) => (
                        <div key={ri} className="flex items-center gap-2">
                          <ZoruInput
                            className="flex-1"
                            placeholder="Row title"
                            value={row.title}
                            onChange={(e) =>
                              updateRow(si, ri, { title: e.target.value })
                            }
                          />
                          <ZoruInput
                            className="flex-1"
                            placeholder="Description"
                            value={row.description}
                            onChange={(e) =>
                              updateRow(si, ri, { description: e.target.value })
                            }
                          />
                          <ZoruButton
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Remove row"
                            onClick={() => removeRow(si, ri)}
                          >
                            <Trash2 />
                          </ZoruButton>
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
              </div>
            </ZoruCard>
          )}

          {msgType === 'product' && (
            <ZoruCard className="p-5">
              <p className="text-[13px] text-zoru-ink-muted">
                Product messages use your connected catalog. Configure products
                in the Catalog section.
              </p>
            </ZoruCard>
          )}
          {msgType === 'location_request' && (
            <ZoruCard className="p-5">
              <p className="text-[13px] text-zoru-ink-muted">
                This message will prompt the user to share their location.
              </p>
            </ZoruCard>
          )}
        </div>

        <ZoruCard className="sticky top-6 self-start p-5">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-zoru-ink-muted" />
            <h2 className="text-[15px] text-zoru-ink">Preview</h2>
          </div>
          <div className="rounded-[var(--zoru-radius)] bg-zoru-surface-2 p-4">
            <div className="max-w-[260px] rounded-[var(--zoru-radius)] bg-zoru-bg p-3 shadow-[var(--zoru-shadow-sm)]">
              <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
                {body || 'Message body…'}
              </p>
              {msgType === 'buttons' && (
                <div className="mt-2 flex flex-col gap-1 border-t border-zoru-line pt-2">
                  {buttonLabels.filter(Boolean).map((l, i) => (
                    <div
                      key={i}
                      className="rounded-[var(--zoru-radius-sm)] border border-zoru-line py-1 text-center text-[12px] text-zoru-ink"
                    >
                      {l}
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
            </div>
          </div>
        </ZoruCard>
      </div>

      {/* Send-test dialog */}
      <ZoruDialog open={testOpen} onOpenChange={setTestOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Send test message</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter a WhatsApp number to deliver the current interactive payload
              for verification.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex flex-col gap-1.5">
            <ZoruLabel htmlFor="test-number">Phone number</ZoruLabel>
            <ZoruInput
              id="test-number"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="+1 234 567 890"
            />
          </div>

          <ZoruDialogFooter>
            <ZoruButton variant="outline" onClick={() => setTestOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleSendTest}>
              <Send /> Send test
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    </div>
  );
}
