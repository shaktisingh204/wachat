'use client';

/**
 * Wachat Conversation Summary — AI-powered conversation summarizer.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuBrain, LuSearch, LuLoader, LuMessageSquare, LuSmile, LuListChecks, LuTag } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

interface Summary {
  contactName: string;
  phone: string;
  messageCount: number;
  summary: string;
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  actionItems: string[];
}

const MOCK_SUMMARY: Summary = {
  contactName: 'John Doe',
  phone: '+1234567890',
  messageCount: 47,
  summary: 'Customer inquired about pricing for the Enterprise plan, requested a demo, and followed up on invoice #1042. Agent provided pricing details, scheduled a demo for next Tuesday, and escalated the invoice issue to billing.',
  topics: ['Pricing', 'Demo Request', 'Billing Issue', 'Enterprise Plan'],
  sentiment: 'positive',
  actionItems: [
    'Send Enterprise plan comparison PDF',
    'Confirm demo slot for Tuesday 2pm',
    'Follow up with billing on invoice #1042',
    'Send post-demo feedback form',
  ],
};

const SENTIMENT_CONFIG = {
  positive: { label: 'Positive', color: 'bg-green-100 text-green-700', icon: '😊' },
  neutral:  { label: 'Neutral',  color: 'bg-zinc-100 text-zinc-600',  icon: '😐' },
  negative: { label: 'Negative', color: 'bg-red-100 text-red-700',    icon: '😟' },
};

export default function ConversationSummaryPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [contactId, setContactId] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  const handleSearch = () => {
    if (!contactId.trim()) {
      toast({ title: 'Required', description: 'Enter a contact ID or phone number.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setSummary(null);
    setTimeout(() => {
      setSummary(MOCK_SUMMARY);
      setLoading(false);
    }, 1500);
  };

  const sentimentCfg = summary ? SENTIMENT_CONFIG[summary.sentiment] : null;

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Conversation Summary' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
          Conversation Summary
        </h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">
          Get AI-generated summaries of any conversation with key topics, sentiment, and action items.
        </p>
      </div>

      {/* Search */}
      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-clay-ink mb-3">Select Conversation</h2>
        <div className="flex gap-3">
          <input
            type="text" value={contactId} onChange={(e) => setContactId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Contact ID or phone number..."
            className="flex-1 rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none"
          />
          <ClayButton size="sm" variant="obsidian" onClick={handleSearch} disabled={loading}>
            {loading ? <LuLoader className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LuSearch className="mr-1.5 h-3.5 w-3.5" />}
            Summarize
          </ClayButton>
        </div>
      </ClayCard>

      {loading && (
        <div className="flex h-32 items-center justify-center gap-3">
          <LuLoader className="h-5 w-5 animate-spin text-clay-ink-muted" />
          <p className="text-[13px] text-clay-ink-muted">Generating summary with AI...</p>
        </div>
      )}

      {summary && !loading && (
        <>
          {/* Summary */}
          <ClayCard padded={false} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-[15px] font-semibold text-clay-ink">{summary.contactName}</h2>
                <p className="text-[12px] text-clay-ink-muted font-mono">{summary.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                <LuMessageSquare className="h-4 w-4 text-clay-ink-muted" />
                <span className="text-[13px] text-clay-ink">{summary.messageCount} messages</span>
              </div>
            </div>
            <div className="rounded-clay-md border border-clay-border bg-clay-bg p-4">
              <LuBrain className="h-4 w-4 text-clay-rose mb-2" />
              <p className="text-[13px] text-clay-ink leading-relaxed">{summary.summary}</p>
            </div>
          </ClayCard>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Topics */}
            <ClayCard padded={false} className="p-5">
              <h3 className="text-[13px] font-semibold text-clay-ink mb-3 flex items-center gap-1.5">
                <LuTag className="h-3.5 w-3.5" /> Key Topics
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {summary.topics.map((t) => <ClayBadge key={t} tone="blue">{t}</ClayBadge>)}
              </div>
            </ClayCard>

            {/* Sentiment */}
            <ClayCard padded={false} className="p-5">
              <h3 className="text-[13px] font-semibold text-clay-ink mb-3 flex items-center gap-1.5">
                <LuSmile className="h-3.5 w-3.5" /> Sentiment
              </h3>
              {sentimentCfg && (
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium ${sentimentCfg.color}`}>
                  {sentimentCfg.icon} {sentimentCfg.label}
                </span>
              )}
            </ClayCard>

            {/* Action Items */}
            <ClayCard padded={false} className="p-5">
              <h3 className="text-[13px] font-semibold text-clay-ink mb-3 flex items-center gap-1.5">
                <LuListChecks className="h-3.5 w-3.5" /> Action Items
              </h3>
              <ul className="space-y-1.5">
                {summary.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-clay-ink">
                    <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-clay-border bg-clay-bg flex items-center justify-center text-[10px] text-clay-ink-muted">{i + 1}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </ClayCard>
          </div>
        </>
      )}

      {!summary && !loading && (
        <ClayCard className="p-12 text-center">
          <LuBrain className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">Enter a contact ID to generate a conversation summary.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
