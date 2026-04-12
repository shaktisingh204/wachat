'use client';

/**
 * Wachat Customer Satisfaction — NPS-style dashboard.
 */

import * as React from 'react';
import { LuSmile, LuMeh, LuFrown, LuTrendingUp } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayCard, ClayBadge } from '@/components/clay';

const SCORE = 72;
const BREAKDOWN = { promoters: 58, passives: 28, detractors: 14 };
const FEEDBACK = [
  { id: '1', contact: 'Rahul S.', score: 9, comment: 'Very responsive team, issue was resolved quickly.', date: '2026-04-12' },
  { id: '2', contact: 'Priya P.', score: 10, comment: 'Excellent support! Would recommend to anyone.', date: '2026-04-11' },
  { id: '3', contact: 'Amit K.', score: 5, comment: 'Took too long to get a response. Needs improvement.', date: '2026-04-11' },
  { id: '4', contact: 'Sneha G.', score: 8, comment: 'Good service overall, minor delays.', date: '2026-04-10' },
  { id: '5', contact: 'Vikram J.', score: 3, comment: 'Issue still not resolved after multiple messages.', date: '2026-04-10' },
  { id: '6', contact: 'Ananya D.', score: 9, comment: 'Fast and helpful. Great experience.', date: '2026-04-09' },
];

function scoreColor(score: number) {
  if (score >= 9) return 'text-emerald-600';
  if (score >= 7) return 'text-amber-600';
  return 'text-red-500';
}

export default function CustomerSatisfactionPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Customer Satisfaction' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Customer Satisfaction</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Track NPS scores and customer feedback from conversations.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ClayCard padded={false} className="p-5 text-center">
          <div className="text-[12px] text-clay-ink-muted mb-1">NPS Score</div>
          <div className="text-[40px] font-bold text-clay-ink leading-none">{SCORE}</div>
          <div className="mt-1 text-[11px] text-emerald-600 flex items-center justify-center gap-1">
            <LuTrendingUp className="h-3 w-3" /> +4 from last month
          </div>
        </ClayCard>
        <ClayCard padded={false} className="flex items-center gap-4 p-5">
          <LuSmile className="h-8 w-8 text-emerald-500 shrink-0" />
          <div>
            <div className="text-[12px] text-clay-ink-muted">Promoters (9-10)</div>
            <div className="text-[22px] font-semibold text-clay-ink leading-tight">{BREAKDOWN.promoters}%</div>
          </div>
        </ClayCard>
        <ClayCard padded={false} className="flex items-center gap-4 p-5">
          <LuMeh className="h-8 w-8 text-amber-500 shrink-0" />
          <div>
            <div className="text-[12px] text-clay-ink-muted">Passives (7-8)</div>
            <div className="text-[22px] font-semibold text-clay-ink leading-tight">{BREAKDOWN.passives}%</div>
          </div>
        </ClayCard>
        <ClayCard padded={false} className="flex items-center gap-4 p-5">
          <LuFrown className="h-8 w-8 text-red-400 shrink-0" />
          <div>
            <div className="text-[12px] text-clay-ink-muted">Detractors (0-6)</div>
            <div className="text-[22px] font-semibold text-clay-ink leading-tight">{BREAKDOWN.detractors}%</div>
          </div>
        </ClayCard>
      </div>

      {/* Score distribution bar */}
      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-clay-ink mb-3">Score Distribution</h2>
        <div className="flex h-6 w-full overflow-hidden rounded-full">
          <div className="bg-emerald-400 transition-all" style={{ width: `${BREAKDOWN.promoters}%` }} />
          <div className="bg-amber-300 transition-all" style={{ width: `${BREAKDOWN.passives}%` }} />
          <div className="bg-red-400 transition-all" style={{ width: `${BREAKDOWN.detractors}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-clay-ink-muted">
          <span>Promoters {BREAKDOWN.promoters}%</span>
          <span>Passives {BREAKDOWN.passives}%</span>
          <span>Detractors {BREAKDOWN.detractors}%</span>
        </div>
      </ClayCard>

      {/* Recent feedback */}
      <ClayCard padded={false} className="overflow-x-auto">
        <div className="px-5 py-4 border-b border-clay-border">
          <h2 className="text-[15px] font-semibold text-clay-ink">Recent Feedback</h2>
        </div>
        <div className="divide-y divide-clay-border">
          {FEEDBACK.map((f) => (
            <div key={f.id} className="px-5 py-3 flex items-start gap-4">
              <span className={`text-[20px] font-bold tabular-nums ${scoreColor(f.score)}`}>{f.score}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-semibold text-clay-ink">{f.contact}</span>
                  <span className="text-[11px] text-clay-ink-muted">{f.date}</span>
                </div>
                <p className="text-[12.5px] text-clay-ink-muted leading-relaxed">{f.comment}</p>
              </div>
            </div>
          ))}
        </div>
      </ClayCard>
      <div className="h-6" />
    </div>
  );
}
