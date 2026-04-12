'use client';

/**
 * Wachat Campaign A/B Test — split-test broadcast campaigns.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuFlaskConical, LuSend, LuChartBar } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

const TEMPLATES = ['Order Confirmation', 'Welcome Message', 'Promo Offer', 'Appointment Reminder', 'Feedback Request'];

interface TestResult { variant: string; sent: number; opened: number; replied: number }

export default function CampaignAbTestPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [variantA, setVariantA] = useState(TEMPLATES[0]);
  const [variantB, setVariantB] = useState(TEMPLATES[2]);
  const [split, setSplit] = useState(50);
  const [audience, setAudience] = useState('all');
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [sending, setSending] = useState(false);

  const handleSend = () => {
    setSending(true);
    setTimeout(() => {
      setResults([
        { variant: 'A', sent: Math.round(500 * split / 100), opened: Math.round(500 * split / 100 * 0.72), replied: Math.round(500 * split / 100 * 0.18) },
        { variant: 'B', sent: Math.round(500 * (100 - split) / 100), opened: Math.round(500 * (100 - split) / 100 * 0.65), replied: Math.round(500 * (100 - split) / 100 * 0.22) },
      ]);
      setSending(false);
      toast({ title: 'Test Complete', description: 'A/B test results are ready.' });
    }, 2000);
  };

  const pct = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0%';

  const inputCls = 'rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink focus:border-clay-accent focus:outline-none w-full';

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Campaign A/B Test' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Campaign A/B Test</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Compare two templates to find which performs better.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Variant A */}
        <ClayCard padded={false} className="p-5">
          <h2 className="text-[15px] font-semibold text-clay-ink mb-3 flex items-center gap-2">
            <ClayBadge tone="blue">A</ClayBadge> Variant A
          </h2>
          <select className={inputCls} value={variantA} onChange={(e) => setVariantA(e.target.value)}>
            {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </ClayCard>

        {/* Variant B */}
        <ClayCard padded={false} className="p-5">
          <h2 className="text-[15px] font-semibold text-clay-ink mb-3 flex items-center gap-2">
            <ClayBadge tone="neutral">B</ClayBadge> Variant B
          </h2>
          <select className={inputCls} value={variantB} onChange={(e) => setVariantB(e.target.value)}>
            {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </ClayCard>
      </div>

      {/* Split & Audience */}
      <ClayCard padded={false} className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-[13px] font-semibold text-clay-ink mb-2">Test Split</h3>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-clay-ink-muted w-8">A: {split}%</span>
              <input type="range" min={10} max={90} value={split} onChange={(e) => setSplit(Number(e.target.value))}
                className="flex-1 accent-clay-rose" />
              <span className="text-[12px] text-clay-ink-muted w-8">B: {100 - split}%</span>
            </div>
            <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full">
              <div className="bg-blue-400 transition-all" style={{ width: `${split}%` }} />
              <div className="bg-amber-400 transition-all" style={{ width: `${100 - split}%` }} />
            </div>
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-clay-ink mb-2">Audience</h3>
            <select className={inputCls} value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="all">All Contacts (500)</option>
              <option value="vip">VIP Customers (120)</option>
              <option value="active">Active Last 30 Days (340)</option>
            </select>
          </div>
        </div>
      </ClayCard>

      <ClayButton variant="obsidian" onClick={handleSend} disabled={sending || variantA === variantB}
        leading={sending ? <LuChartBar className="h-4 w-4 animate-pulse" /> : <LuSend className="h-4 w-4" />}>
        {sending ? 'Running Test...' : 'Launch A/B Test'}
      </ClayButton>

      {variantA === variantB && (
        <p className="text-[12px] text-clay-red">Variants A and B must use different templates.</p>
      )}

      {/* Results */}
      {results && (
        <ClayCard padded={false} className="p-5">
          <h2 className="text-[15px] font-semibold text-clay-ink mb-4 flex items-center gap-2">
            <LuFlaskConical className="h-4 w-4" /> Results
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((r) => {
              const openRate = pct(r.opened, r.sent);
              const replyRate = pct(r.replied, r.sent);
              const isWinner = r.replied / r.sent >= (results.find((x) => x.variant !== r.variant)?.replied ?? 0) / (results.find((x) => x.variant !== r.variant)?.sent ?? 1);
              return (
                <div key={r.variant} className={`rounded-clay-md border p-4 ${isWinner ? 'border-green-300 bg-green-50' : 'border-clay-border'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[14px] font-semibold text-clay-ink">
                      Variant {r.variant}: {r.variant === 'A' ? variantA : variantB}
                    </h3>
                    {isWinner && <ClayBadge tone="green">Winner</ClayBadge>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[18px] font-semibold text-clay-ink">{r.sent}</p>
                      <p className="text-[11px] text-clay-ink-muted">Sent</p>
                    </div>
                    <div>
                      <p className="text-[18px] font-semibold text-clay-ink">{openRate}</p>
                      <p className="text-[11px] text-clay-ink-muted">Open Rate</p>
                    </div>
                    <div>
                      <p className="text-[18px] font-semibold text-clay-ink">{replyRate}</p>
                      <p className="text-[11px] text-clay-ink-muted">Reply Rate</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
