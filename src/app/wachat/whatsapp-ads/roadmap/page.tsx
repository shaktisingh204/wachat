'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { Check, ThumbsUp, RefreshCw, Route, Sparkles } from 'lucide-react';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  StatusPill,
  PhoneFrame,
  ChatBubble,
  type StatusTone,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

/**
 * WhatsApp Ads roadmap - editorial preview of what's shipped, in
 * progress, and planned for the Meta Marketing API integration.
 */

type RoadmapStatus = 'Live' | 'In beta' | 'In progress' | 'Planned';
type RoadmapPhase = {
  phase: string;
  title: string;
  description: string;
  milestones: string[];
  status: RoadmapStatus;
  votes: number;
};

const INITIAL_ROADMAP: RoadmapPhase[] = [
  {
    phase: 'MVP',
    title: 'Minimum viable product',
    description: 'Embedded signup, account linking, campaign creation, all working in production.',
    milestones: ['Embedded signup for easy onboarding', 'List connected user assets (pages, ad accounts)', 'Basic campaign creation'],
    status: 'Live',
    votes: 120,
  },
  {
    phase: 'Phase 2',
    title: 'Insights and management',
    description: 'Deeper performance signals plus audience and lead tooling.',
    milestones: ['Advanced campaign performance insights', 'Audience management tools', 'Sync leads from Lead Ads'],
    status: 'In progress',
    votes: 85,
  },
  {
    phase: 'Phase 3',
    title: 'Automation and optimization',
    description: 'Hands-off optimization with DCO, rules, and creative tests.',
    milestones: ['Dynamic Creative Optimization (DCO) support', 'Automated rules for budget and bidding', 'A/B testing for creatives and copy'],
    status: 'Planned',
    votes: 215,
  },
  {
    phase: 'Phase 4',
    title: 'Scale and enterprise',
    description: 'Multi-seat workspaces, structured reporting, and catalog ads.',
    milestones: ['Multi-user dashboards with role-based access', 'Advanced billing and performance reports', 'Full support for catalog-based ads'],
    status: 'Planned',
    votes: 42,
  },
];

const fetchLiveRoadmap = async (): Promise<RoadmapPhase[]> =>
  new Promise((resolve) => setTimeout(() => resolve([...INITIAL_ROADMAP]), 1200));

const statusToTone = (s: RoadmapStatus): StatusTone => {
  if (s === 'Live') return 'live';
  if (s === 'In beta') return 'sending';
  if (s === 'In progress') return 'queued';
  return 'draft';
};

export default function AdsRoadmapPage() {
  const reduce = useReducedMotion();
  const [phases, setPhases] = useState<RoadmapPhase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoadmap = async () => {
    setIsLoading(true);
    setError(null);
    try { setPhases(await fetchLiveRoadmap()); }
    catch { setError('Failed to sync. Please try again later.'); }
    finally { setIsLoading(false); }
  };
  useEffect(() => { loadRoadmap(); }, []);

  const handleVote = (phase: string) =>
    setPhases((prev) => prev.map((p) => (p.phase === phase ? { ...p, votes: p.votes + 1 } : p)));

  return (
    <WaPage>
      <PageHeader
        title="Ad platform roadmap"
        description="What we shipped, what we're building, and what's next for click-to-WhatsApp ads."
        kicker="Wachat · roadmap"
        eyebrowIcon={Route}
        actions={
          <WaButton variant="outline" onClick={loadRoadmap} disabled={isLoading} leftIcon={RefreshCw}>
            Resync
          </WaButton>
        }
      />

      {/* Editorial hero */}
      <section className="mb-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ background: 'var(--mt-accent-soft)', color: 'var(--mt-accent)' }}
          >
            <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden /> Public roadmap
          </span>
          <h2 className="mt-4 text-balance text-[40px] font-semibold leading-[1.05] tracking-tight text-zinc-950 md:text-[52px]">
            One platform for every WhatsApp ad you ever run.
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-600">
            Click-to-WhatsApp, lead ads, catalog ads, and re-engagement, all wired to the same inbox and automation.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-[12.5px] text-zinc-600">
            <StatusPill tone="live">Live</StatusPill>
            <StatusPill tone="queued">In progress</StatusPill>
            <StatusPill tone="draft">Planned</StatusPill>
          </div>
        </m.div>

        <m.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: EASE_OUT, delay: 0.1 }}
        >
          <PhoneFrame title="Acme Co." subtitle="online · click-to-chat" verified>
            <ChatBubble who="them" text="Saw your ad. Is the 20% off still live?" time="10:24" delay={0.2} />
            <ChatBubble who="us" text="Yes! Code SUMMER20 at checkout. Want me to send the link?" time="10:25" delay={0.45} />
            <ChatBubble who="us" kind="cta" text="Tap to shop" delay={0.7} />
          </PhoneFrame>
        </m.div>
      </section>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] text-rose-700">
          {error}
        </div>
      )}

      {/* Phase grid */}
      <section className="grid gap-4 md:grid-cols-2">
        {isLoading && phases.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[260px] animate-pulse rounded-2xl border border-zinc-200 bg-white p-5" />
            ))
          : phases.map((phase, i) => (
              <m.article
                key={phase.phase}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: reduce ? 0 : 0.45, delay: reduce ? 0 : i * 0.06, ease: EASE_OUT }}
                className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{phase.phase}</p>
                    <h3 className="mt-1 text-[18px] font-semibold tracking-tight text-zinc-950">{phase.title}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">{phase.description}</p>
                  </div>
                  <StatusPill tone={statusToTone(phase.status)}>{phase.status}</StatusPill>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {phase.milestones.map((m2) => (
                    <li key={m2} className="flex items-start gap-2.5 text-[13px] text-zinc-800">
                      <span
                        className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full"
                        style={{ background: 'var(--mt-accent-soft)' }}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} style={{ color: 'var(--mt-accent)' }} aria-hidden />
                      </span>
                      <span>{m2}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-3">
                  <span className="text-[12px] font-semibold tabular-nums text-zinc-500">
                    {phase.votes.toLocaleString('en-IN')} votes
                  </span>
                  <WaButton variant="outline" size="sm" leftIcon={ThumbsUp} onClick={() => handleVote(phase.phase)}>
                    Upvote
                  </WaButton>
                </div>
              </m.article>
            ))}
      </section>
    </WaPage>
  );
}
