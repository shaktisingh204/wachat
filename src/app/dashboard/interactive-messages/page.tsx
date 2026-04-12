'use client';

/**
 * Wachat Interactive Messages — build interactive WhatsApp messages.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuMousePointerClick, LuPlus, LuTrash2, LuEye } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

type MsgType = 'buttons' | 'list' | 'product' | 'location_request';

interface ListRow { title: string; description: string }
interface ListSection { title: string; rows: ListRow[] }

export default function InteractiveMessagesPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [msgType, setMsgType] = useState<MsgType>('buttons');
  const [body, setBody] = useState('Please choose an option below:');
  const [buttonLabels, setButtonLabels] = useState(['Option A', 'Option B', '']);
  const [sections, setSections] = useState<ListSection[]>([
    { title: 'Main Menu', rows: [{ title: 'Sales', description: 'Talk to sales' }, { title: 'Support', description: 'Get help' }] },
  ]);

  const updateButton = (i: number, val: string) => {
    setButtonLabels((prev) => prev.map((b, idx) => (idx === i ? val : b)));
  };

  const addSection = () => setSections((p) => [...p, { title: '', rows: [{ title: '', description: '' }] }]);
  const removeSection = (i: number) => setSections((p) => p.filter((_, idx) => idx !== i));
  const updateSection = (i: number, title: string) => setSections((p) => p.map((s, idx) => (idx === i ? { ...s, title } : s)));
  const addRow = (si: number) => setSections((p) => p.map((s, idx) => (idx === si ? { ...s, rows: [...s.rows, { title: '', description: '' }] } : s)));
  const updateRow = (si: number, ri: number, patch: Partial<ListRow>) => {
    setSections((p) => p.map((s, idx) => (idx === si ? { ...s, rows: s.rows.map((r, j) => (j === ri ? { ...r, ...patch } : r)) } : s)));
  };
  const removeRow = (si: number, ri: number) => {
    setSections((p) => p.map((s, idx) => (idx === si ? { ...s, rows: s.rows.filter((_, j) => j !== ri) } : s)));
  };

  const handleSend = () => toast({ title: 'Sent', description: 'Interactive message sent.' });

  const inputCls = 'rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none w-full';

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Interactive Messages' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Interactive Messages</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Build interactive WhatsApp messages with buttons, lists, and more.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {/* Type selector */}
          <ClayCard padded={false} className="p-5">
            <h2 className="text-[15px] font-semibold text-clay-ink mb-3">Message Type</h2>
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'buttons', label: 'Buttons' },
                { value: 'list', label: 'List Menu' },
                { value: 'product', label: 'Product' },
                { value: 'location_request', label: 'Location Request' },
              ] as const).map((t) => (
                <button key={t.value} onClick={() => setMsgType(t.value)}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    msgType === t.value ? 'bg-clay-ink text-white' : 'bg-clay-bg text-clay-ink-muted border border-clay-border hover:bg-clay-bg-2'
                  }`}>{t.label}</button>
              ))}
            </div>
          </ClayCard>

          {/* Body */}
          <ClayCard padded={false} className="p-5">
            <h2 className="text-[15px] font-semibold text-clay-ink mb-3">Body Text</h2>
            <textarea className="clay-input min-h-[80px] resize-y py-2.5 w-full" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body..." />
          </ClayCard>

          {/* Buttons config */}
          {msgType === 'buttons' && (
            <ClayCard padded={false} className="p-5">
              <h2 className="text-[15px] font-semibold text-clay-ink mb-3">Buttons (max 3)</h2>
              <div className="space-y-2">
                {buttonLabels.map((label, i) => (
                  <input key={i} className={inputCls} placeholder={`Button ${i + 1} label`} value={label} onChange={(e) => updateButton(i, e.target.value)} />
                ))}
              </div>
            </ClayCard>
          )}

          {/* List config */}
          {msgType === 'list' && (
            <ClayCard padded={false} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-semibold text-clay-ink">Sections</h2>
                <ClayButton size="sm" variant="ghost" onClick={addSection}><LuPlus className="mr-1 h-3.5 w-3.5" /> Section</ClayButton>
              </div>
              {sections.map((sec, si) => (
                <div key={si} className="mb-4 rounded-clay-md border border-clay-border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input className={inputCls} placeholder="Section title" value={sec.title} onChange={(e) => updateSection(si, e.target.value)} />
                    <button onClick={() => removeSection(si)} className="text-clay-red shrink-0"><LuTrash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {sec.rows.map((row, ri) => (
                    <div key={ri} className="flex gap-2 mb-1.5">
                      <input className="flex-1 rounded-md border border-clay-border bg-clay-bg px-2 py-1.5 text-[12px] text-clay-ink" placeholder="Row title" value={row.title} onChange={(e) => updateRow(si, ri, { title: e.target.value })} />
                      <input className="flex-1 rounded-md border border-clay-border bg-clay-bg px-2 py-1.5 text-[12px] text-clay-ink" placeholder="Description" value={row.description} onChange={(e) => updateRow(si, ri, { description: e.target.value })} />
                      <button onClick={() => removeRow(si, ri)} className="text-clay-red shrink-0"><LuTrash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                  <button onClick={() => addRow(si)} className="text-[11px] text-clay-ink-muted hover:text-clay-ink mt-1">+ Add row</button>
                </div>
              ))}
            </ClayCard>
          )}

          {/* Product / Location */}
          {msgType === 'product' && (
            <ClayCard padded={false} className="p-5">
              <p className="text-[13px] text-clay-ink-muted">Product messages use your connected catalog. Configure products in the Catalog section.</p>
            </ClayCard>
          )}
          {msgType === 'location_request' && (
            <ClayCard padded={false} className="p-5">
              <p className="text-[13px] text-clay-ink-muted">This message will prompt the user to share their location.</p>
            </ClayCard>
          )}

          <ClayButton variant="obsidian" onClick={handleSend} leading={<LuMousePointerClick className="h-4 w-4" />}>Send Message</ClayButton>
        </div>

        {/* Preview */}
        <ClayCard padded={false} className="p-5 self-start sticky top-6">
          <h2 className="text-[15px] font-semibold text-clay-ink mb-3"><LuEye className="inline mr-1.5 h-4 w-4" />Preview</h2>
          <div className="rounded-xl bg-[#e5ddd5] p-4">
            <div className="max-w-[260px] rounded-lg bg-white p-3 shadow-sm">
              <p className="text-[13px] text-gray-800 whitespace-pre-wrap">{body || 'Message body...'}</p>
              {msgType === 'buttons' && (
                <div className="mt-2 border-t border-gray-200 pt-2 flex flex-col gap-1">
                  {buttonLabels.filter(Boolean).map((l, i) => (
                    <div key={i} className="text-center text-[12px] font-medium text-blue-600 py-1 border border-blue-200 rounded">{l}</div>
                  ))}
                </div>
              )}
              {msgType === 'list' && (
                <div className="mt-2 border-t border-gray-200 pt-2 text-center text-[12px] font-medium text-blue-600 py-1">Menu</div>
              )}
              {msgType === 'location_request' && (
                <div className="mt-2 border-t border-gray-200 pt-2 text-center text-[12px] font-medium text-blue-600 py-1">Send Location</div>
              )}
            </div>
          </div>
        </ClayCard>
      </div>
      <div className="h-6" />
    </div>
  );
}
