'use client';

/**
 * Wachat Template Builder — visual WhatsApp template builder, rebuilt
 * on ZoruUI primitives. Save copies the JSON payload to clipboard
 * after a confirm dialog.
 */

import * as React from 'react';
import { useState } from 'react';
import {
  Plus,
  Eye,
  Copy,
  Trash2,
} from 'lucide-react';

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
  ZoruCardContent,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';

type HeaderType = 'none' | 'text' | 'image' | 'video' | 'document';
type BtnType = 'quick_reply' | 'url' | 'phone';

interface TplButton {
  type: BtnType;
  text: string;
  value: string;
}

export default function TemplateBuilderPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();

  const [category, setCategory] = useState('marketing');
  const [headerType, setHeaderType] = useState<HeaderType>('none');
  const [headerText, setHeaderText] = useState('');
  const [body, setBody] = useState(
    'Hello {{1}}, your order {{2}} is confirmed!',
  );
  const [footer, setFooter] = useState('Powered by Wachat');
  const [buttons, setButtons] = useState<TplButton[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);

  const insertVar = (n: number) => setBody((p) => p + ` {{${n}}}`);
  const addButton = () => {
    if (buttons.length < 3)
      setButtons((p) => [...p, { type: 'quick_reply', text: '', value: '' }]);
  };
  const updateButton = (i: number, patch: Partial<TplButton>) =>
    setButtons((p) =>
      p.map((b, idx) => (idx === i ? { ...b, ...patch } : b)),
    );
  const removeButton = (i: number) =>
    setButtons((p) => p.filter((_, idx) => idx !== i));

  const buildPayload = () => {
    const components: any[] = [];
    if (headerType === 'text' && headerText)
      components.push({ type: 'HEADER', format: 'TEXT', text: headerText });
    else if (headerType !== 'none')
      components.push({ type: 'HEADER', format: headerType.toUpperCase() });
    components.push({ type: 'BODY', text: body });
    if (footer) components.push({ type: 'FOOTER', text: footer });
    if (buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map((b) => ({
          type:
            b.type === 'quick_reply' ? 'QUICK_REPLY' : b.type.toUpperCase(),
          text: b.text,
          ...(b.type !== 'quick_reply' ? { [b.type]: b.value } : {}),
        })),
      });
    }
    return {
      name: `template_${Date.now()}`,
      category: category.toUpperCase(),
      language: 'en_US',
      components,
    };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    const json = JSON.stringify(payload, null, 2);
    await navigator.clipboard.writeText(json);
    toast({
      title: 'Template JSON copied',
      description: `Template payload (${json.length} chars) copied to clipboard. Submit to Meta for approval.`,
    });
    setSaveOpen(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
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
            <ZoruBreadcrumbLink href="/wachat/templates">
              Templates
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Builder</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader bordered={false}>
        <ZoruPageHeading>
          <ZoruPageTitle>Template builder</ZoruPageTitle>
          <ZoruPageDescription>
            Build WhatsApp message templates visually. Save copies the JSON
            payload to your clipboard for submission.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <ZoruCard>
            <ZoruCardContent className="space-y-3 pt-6">
              <h2 className="text-[15px] font-semibold text-zoru-ink">
                Category
              </h2>
              <ZoruSelect value={category} onValueChange={setCategory}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="marketing">Marketing</ZoruSelectItem>
                  <ZoruSelectItem value="utility">Utility</ZoruSelectItem>
                  <ZoruSelectItem value="authentication">
                    Authentication
                  </ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardContent className="space-y-3 pt-6">
              <h2 className="text-[15px] font-semibold text-zoru-ink">
                Header
              </h2>
              <div className="flex flex-wrap gap-2">
                {(['none', 'text', 'image', 'video', 'document'] as const).map(
                  (t) => {
                    const isActive = headerType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setHeaderType(t)}
                        className={cn(
                          'rounded-[var(--zoru-radius)] border px-3 py-1.5 text-[12px] font-medium capitalize transition-colors',
                          isActive
                            ? 'border-zoru-ink bg-zoru-ink text-zoru-on-primary'
                            : 'border-zoru-line bg-zoru-bg text-zoru-ink-muted hover:text-zoru-ink',
                        )}
                      >
                        {t}
                      </button>
                    );
                  },
                )}
              </div>
              {headerType === 'text' && (
                <ZoruInput
                  placeholder="Header text"
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                />
              )}
              {(headerType === 'image' ||
                headerType === 'video' ||
                headerType === 'document') && (
                <p className="text-[12px] text-zoru-ink-muted">
                  Upload {headerType} when submitting for approval.
                </p>
              )}
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardContent className="space-y-3 pt-6">
              <h2 className="text-[15px] font-semibold text-zoru-ink">Body</h2>
              <ZoruTextarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Message body…"
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-zoru-ink-muted">
                  Variables:
                </span>
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => insertVar(n)}
                    className="rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-bg px-2 py-1 font-mono text-[11px] text-zoru-ink hover:bg-zoru-surface"
                  >{`{{${n}}}`}</button>
                ))}
              </div>
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardContent className="space-y-3 pt-6">
              <h2 className="text-[15px] font-semibold text-zoru-ink">
                Footer
              </h2>
              <ZoruInput
                placeholder="Footer text (optional)"
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
              />
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-zoru-ink">
                  Buttons ({buttons.length}/3)
                </h2>
                <ZoruButton
                  size="sm"
                  variant="outline"
                  onClick={addButton}
                  disabled={buttons.length >= 3}
                >
                  <Plus /> Add
                </ZoruButton>
              </div>
              {buttons.map((btn, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3"
                >
                  <div className="min-w-[140px]">
                    <ZoruSelect
                      value={btn.type}
                      onValueChange={(v) =>
                        updateButton(i, { type: v as BtnType })
                      }
                    >
                      <ZoruSelectTrigger>
                        <ZoruSelectValue />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        <ZoruSelectItem value="quick_reply">
                          Quick reply
                        </ZoruSelectItem>
                        <ZoruSelectItem value="url">URL</ZoruSelectItem>
                        <ZoruSelectItem value="phone">Phone</ZoruSelectItem>
                      </ZoruSelectContent>
                    </ZoruSelect>
                  </div>
                  <ZoruInput
                    className="min-w-[120px] flex-1"
                    placeholder="Button label"
                    value={btn.text}
                    onChange={(e) =>
                      updateButton(i, { text: e.target.value })
                    }
                  />
                  {btn.type !== 'quick_reply' && (
                    <ZoruInput
                      className="min-w-[120px] flex-1"
                      placeholder={
                        btn.type === 'url' ? 'https://…' : '+1234567890'
                      }
                      value={btn.value}
                      onChange={(e) =>
                        updateButton(i, { value: e.target.value })
                      }
                    />
                  )}
                  <ZoruButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove button"
                    onClick={() => removeButton(i)}
                  >
                    <Trash2 />
                  </ZoruButton>
                </div>
              ))}
            </ZoruCardContent>
          </ZoruCard>

          <ZoruButton onClick={() => setSaveOpen(true)}>
            <Copy /> Save template (copy JSON)
          </ZoruButton>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <ZoruCard variant="elevated">
            <ZoruCardContent className="space-y-3 pt-6">
              <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-zoru-ink">
                <Eye className="h-4 w-4" /> Preview
              </h2>
              <div className="rounded-[var(--zoru-radius-lg)] bg-zoru-surface p-4">
                <div className="max-w-[260px] rounded-[var(--zoru-radius)] bg-zoru-bg p-3 shadow-[var(--zoru-shadow-sm)]">
                  {headerType === 'text' && headerText && (
                    <p className="mb-1 text-[13px] font-semibold text-zoru-ink">
                      {headerText}
                    </p>
                  )}
                  {headerType !== 'none' && headerType !== 'text' && (
                    <div className="mb-2 flex h-24 items-center justify-center rounded bg-zoru-surface-2 text-[11px] uppercase text-zoru-ink-subtle">
                      {headerType}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-[13px] text-zoru-ink">
                    {body || 'Message body…'}
                  </p>
                  {footer && (
                    <p className="mt-2 text-[11px] text-zoru-ink-muted">
                      {footer}
                    </p>
                  )}
                  {buttons.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 border-t border-zoru-line pt-2">
                      {buttons.map((b, i) => (
                        <div
                          key={i}
                          className="py-1 text-center text-[12px] font-medium text-zoru-ink"
                        >
                          {b.text || 'Button'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {activeProject?.name && (
                <ZoruLabel className="block text-[10px] uppercase tracking-wide text-zoru-ink-subtle">
                  Project: {activeProject.name}
                </ZoruLabel>
              )}
            </ZoruCardContent>
          </ZoruCard>
        </div>
      </div>

      {/* Save-template confirm dialog */}
      <ZoruDialog open={saveOpen} onOpenChange={setSaveOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Save template</ZoruDialogTitle>
            <ZoruDialogDescription>
              The template JSON payload will be copied to your clipboard.
              Paste it into your Meta Business Manager (or the Templates page)
              to submit it for approval.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton onClick={handleSave}>
              <Copy /> Copy JSON
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

      <div className="h-6" />
    </div>
  );
}
