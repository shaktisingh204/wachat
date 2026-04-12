'use client';

/**
 * Wachat Template Builder — visual WhatsApp message template builder.
 * Save shows a toast with the full JSON payload.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuChartBar, LuCircleCheck, LuCircleX, LuTriangleAlert, LuPlus, LuEye, LuCopy } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

type HeaderType = 'none' | 'text' | 'image' | 'video' | 'document';
type BtnType = 'quick_reply' | 'url' | 'phone';
interface TplButton { type: BtnType; text: string; value: string }

export default function TemplateBuilderPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [category, setCategory] = useState('marketing');
  const [headerType, setHeaderType] = useState<HeaderType>('none');
  const [headerText, setHeaderText] = useState('');
  const [body, setBody] = useState('Hello {{1}}, your order {{2}} is confirmed!');
  const [footer, setFooter] = useState('Powered by Wachat');
  const [buttons, setButtons] = useState<TplButton[]>([]);

  const insertVar = (n: number) => setBody((p) => p + ` {{${n}}}`);
  const addButton = () => { if (buttons.length < 3) setButtons((p) => [...p, { type: 'quick_reply', text: '', value: '' }]); };
  const updateButton = (i: number, patch: Partial<TplButton>) => setButtons((p) => p.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const removeButton = (i: number) => setButtons((p) => p.filter((_, idx) => idx !== i));

  const buildPayload = () => {
    const components: any[] = [];
    if (headerType === 'text' && headerText) components.push({ type: 'HEADER', format: 'TEXT', text: headerText });
    else if (headerType !== 'none') components.push({ type: 'HEADER', format: headerType.toUpperCase() });
    components.push({ type: 'BODY', text: body });
    if (footer) components.push({ type: 'FOOTER', text: footer });
    if (buttons.length > 0) {
      components.push({ type: 'BUTTONS', buttons: buttons.map((b) => ({ type: b.type === 'quick_reply' ? 'QUICK_REPLY' : b.type.toUpperCase(), text: b.text, ...(b.type !== 'quick_reply' ? { [b.type]: b.value } : {}) })) });
    }
    return { name: `template_${Date.now()}`, category: category.toUpperCase(), language: 'en_US', components };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    const json = JSON.stringify(payload, null, 2);
    await navigator.clipboard.writeText(json);
    toast({ title: 'Template JSON Copied', description: `Template payload (${json.length} chars) copied to clipboard. Submit to Meta for approval.` });
  };

  const inputCls = 'rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none w-full';

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Template Builder' },
      ]} />
      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Template Builder</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Build WhatsApp message templates visually. Save copies JSON to clipboard.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <ClayCard padded={false} className="p-5">
            <h2 className="text-[15px] font-semibold text-clay-ink mb-3">Category</h2>
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="marketing">Marketing</option>
              <option value="utility">Utility</option>
              <option value="authentication">Authentication</option>
            </select>
          </ClayCard>

          <ClayCard padded={false} className="p-5">
            <h2 className="text-[15px] font-semibold text-clay-ink mb-3">Header</h2>
            <div className="flex gap-2 mb-3">
              {(['none', 'text', 'image', 'video', 'document'] as const).map((t) => (
                <button key={t} onClick={() => setHeaderType(t)}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition-colors ${headerType === t ? 'bg-clay-ink text-white' : 'bg-clay-bg text-clay-ink-muted hover:bg-clay-bg-2 border border-clay-border'}`}>{t}</button>
              ))}
            </div>
            {headerType === 'text' && <input className={inputCls} placeholder="Header text" value={headerText} onChange={(e) => setHeaderText(e.target.value)} />}
            {(headerType === 'image' || headerType === 'video' || headerType === 'document') && (
              <p className="text-[12px] text-clay-ink-muted">Upload {headerType} when submitting for approval.</p>
            )}
          </ClayCard>

          <ClayCard padded={false} className="p-5">
            <h2 className="text-[15px] font-semibold text-clay-ink mb-3">Body</h2>
            <textarea className="clay-input min-h-[96px] resize-y py-2.5 w-full" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body..." />
            <div className="mt-2 flex gap-2">
              <span className="text-[12px] text-clay-ink-muted self-center">Variables:</span>
              {[1, 2, 3].map((n) => (
                <button key={n} onClick={() => insertVar(n)} className="rounded-md border border-clay-border bg-clay-bg px-2 py-1 text-[11px] font-mono text-clay-ink hover:bg-clay-bg-2">{`{{${n}}}`}</button>
              ))}
            </div>
          </ClayCard>

          <ClayCard padded={false} className="p-5">
            <h2 className="text-[15px] font-semibold text-clay-ink mb-3">Footer</h2>
            <input className={inputCls} placeholder="Footer text (optional)" value={footer} onChange={(e) => setFooter(e.target.value)} />
          </ClayCard>

          <ClayCard padded={false} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-semibold text-clay-ink">Buttons ({buttons.length}/3)</h2>
              <ClayButton size="sm" variant="ghost" onClick={addButton} disabled={buttons.length >= 3}><LuPlus className="mr-1 h-3.5 w-3.5" /> Add</ClayButton>
            </div>
            {buttons.map((btn, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 mb-2 rounded-clay-md border border-clay-border p-3">
                <select className="rounded-md border border-clay-border bg-clay-bg px-2 py-1.5 text-[12px] text-clay-ink" value={btn.type} onChange={(e) => updateButton(i, { type: e.target.value as BtnType })}>
                  <option value="quick_reply">Quick Reply</option>
                  <option value="url">URL</option>
                  <option value="phone">Phone</option>
                </select>
                <input className="flex-1 min-w-[120px] rounded-md border border-clay-border bg-clay-bg px-2 py-1.5 text-[12px] text-clay-ink" placeholder="Button label" value={btn.text} onChange={(e) => updateButton(i, { text: e.target.value })} />
                {btn.type !== 'quick_reply' && (
                  <input className="flex-1 min-w-[120px] rounded-md border border-clay-border bg-clay-bg px-2 py-1.5 text-[12px] text-clay-ink" placeholder={btn.type === 'url' ? 'https://...' : '+1234567890'} value={btn.value} onChange={(e) => updateButton(i, { value: e.target.value })} />
                )}
                <button onClick={() => removeButton(i)} className="text-[12px] text-clay-red hover:underline">Remove</button>
              </div>
            ))}
          </ClayCard>

          <ClayButton variant="obsidian" onClick={handleSave} leading={<LuCopy className="h-4 w-4" />}>Save Template (Copy JSON)</ClayButton>
        </div>

        <ClayCard padded={false} className="p-5 self-start sticky top-6">
          <h2 className="text-[15px] font-semibold text-clay-ink mb-3"><LuEye className="inline mr-1.5 h-4 w-4" />Preview</h2>
          <div className="rounded-xl bg-[#e5ddd5] p-4">
            <div className="max-w-[260px] rounded-lg bg-white p-3 shadow-sm">
              {headerType === 'text' && headerText && <p className="font-semibold text-[13px] text-gray-900 mb-1">{headerText}</p>}
              {headerType !== 'none' && headerType !== 'text' && <div className="mb-2 h-24 rounded bg-gray-200 flex items-center justify-center text-[11px] text-gray-400 uppercase">{headerType}</div>}
              <p className="text-[13px] text-gray-800 whitespace-pre-wrap">{body || 'Message body...'}</p>
              {footer && <p className="mt-2 text-[11px] text-gray-400">{footer}</p>}
              {buttons.length > 0 && (
                <div className="mt-2 border-t border-gray-200 pt-2 flex flex-col gap-1">
                  {buttons.map((b, i) => <div key={i} className="text-center text-[12px] font-medium text-blue-600 py-1">{b.text || 'Button'}</div>)}
                </div>
              )}
            </div>
          </div>
        </ClayCard>
      </div>
      <div className="h-6" />
    </div>
  );
}
