'use client';

import { m } from 'motion/react';
import { CheckCircle2, AlertTriangle, Clock, Rss } from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';

const SERVICES = [
    { name: 'API · v1', status: 'operational', uptime: 99.997 },
    { name: 'Wachat · WhatsApp Business', status: 'operational', uptime: 99.984 },
    { name: 'SabWa · personal WhatsApp', status: 'operational', uptime: 99.92 },
    { name: 'SabChat · omnichannel inbox', status: 'operational', uptime: 99.998 },
    { name: 'SabFlow · automation engine', status: 'operational', uptime: 99.991 },
    { name: 'CRM · pipelines + invoices', status: 'operational', uptime: 99.999 },
    { name: 'HRM · payroll + attendance', status: 'operational', uptime: 99.995 },
    { name: 'SabMail · email delivery', status: 'degraded', uptime: 99.42 },
    { name: 'SabSMS · DLT routes', status: 'operational', uptime: 99.98 },
    { name: 'SabCall · IVR + dialer', status: 'operational', uptime: 99.991 },
    { name: 'SabFiles · object storage', status: 'operational', uptime: 99.9999 },
    { name: 'Dashboards · BI', status: 'operational', uptime: 99.97 },
    { name: 'Webhooks · outbound', status: 'operational', uptime: 99.989 },
    { name: 'Admin · auth + RBAC', status: 'operational', uptime: 99.997 },
];

const INCIDENTS = [
    {
        date: '2026-05-26',
        title: 'Elevated email delivery latency · resolved',
        status: 'resolved',
        timeline: [
            { t: '14:42 IST', what: 'Detected · queue depth alert' },
            { t: '14:48 IST', what: 'Investigating · upstream provider rate limit' },
            { t: '15:14 IST', what: 'Mitigated · failed over to backup route' },
            { t: '15:32 IST', what: 'Resolved · backlog flushed, monitoring' },
        ],
    },
    {
        date: '2026-05-12',
        title: 'WhatsApp template delivery delay (regional)',
        status: 'resolved',
        timeline: [
            { t: '09:18 IST', what: 'Detected · Mumbai region delivery lag' },
            { t: '09:25 IST', what: 'Identified · Meta WABA edge issue' },
            { t: '10:02 IST', what: 'Resolved · routed via secondary edge' },
        ],
    },
    {
        date: '2026-04-28',
        title: 'Scheduled maintenance · database failover',
        status: 'completed',
        timeline: [
            { t: '02:00 IST', what: 'Started · planned failover to standby' },
            { t: '02:14 IST', what: 'Completed · zero downtime, traffic normal' },
        ],
    },
];

export function StatusClient({ session }: { session?: { user?: unknown } | null }) {
    const overall = SERVICES.some((s) => s.status === 'degraded')
        ? 'Partial degradation'
        : SERVICES.some((s) => s.status === 'outage')
          ? 'Major outage'
          : 'All systems operational';
    const overallTone = SERVICES.some((s) => s.status !== 'operational') ? 'amber' : 'emerald';

    return (
        <MarketingShell session={session}>
            <PageHero
                kicker="Status · live"
                title={
                    <>
                        {overallTone === 'emerald' ? (
                            <>All systems <span className="bg-gradient-to-r from-[var(--st-text)] via-[var(--st-text)] to-[var(--st-text)] bg-clip-text text-transparent">operational.</span></>
                        ) : (
                            <>Some systems <span className="text-[var(--st-text)]">degraded.</span></>
                        )}
                    </>
                }
                subtitle="Live status of every SabNode service. Subscribe to alerts via RSS or webhooks."
                extra={
                    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--st-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--st-text)]">
                        <Rss className="h-3.5 w-3.5 text-[var(--st-text)]" /> Subscribe to status RSS
                    </div>
                }
            />

            {/* Overall banner */}
            <SectionWrap>
                <m.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className={`flex items-center gap-3 rounded-2xl border p-5 ${overallTone === 'emerald' ? 'border-[var(--st-border)] bg-[var(--st-bg-muted)]' : 'border-[var(--st-border)] bg-[var(--st-bg-muted)]'}`}>
                    {overallTone === 'emerald' ? (
                        <CheckCircle2 className="h-6 w-6 text-[var(--st-text)]" />
                    ) : (
                        <AlertTriangle className="h-6 w-6 text-[var(--st-text)]" />
                    )}
                    <div>
                        <p className={`text-base font-semibold ${overallTone === 'emerald' ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'}`}>{overall}</p>
                        <p className="text-[12px] text-[var(--st-text)]">Last checked just now · 90-day average uptime 99.97%</p>
                    </div>
                </m.div>

                {/* Service list */}
                <div className="mt-10 overflow-hidden rounded-3xl border border-[var(--st-border)] bg-white">
                    {SERVICES.map((s, i) => (
                        <m.div key={s.name} initial={{ opacity: 0, x: -4 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.02 }}
                            className="flex items-center gap-3 border-b border-[var(--st-border)] px-5 py-3 last:border-0">
                            <span className={`h-2.5 w-2.5 rounded-full ${
                                s.status === 'operational' ? 'bg-[var(--st-text)]' : s.status === 'degraded' ? 'bg-[var(--st-text)]' : 'bg-[var(--st-text)]'
                            }`} />
                            <span className="flex-1 text-[14px] text-[var(--st-text)]">{s.name}</span>
                            <div className="flex items-center gap-3">
                                {/* 90-day bar chart */}
                                <div className="hidden gap-0.5 sm:flex">
                                    {Array.from({ length: 60 }).map((_, k) => {
                                        const off = Math.random() < (s.uptime < 99.9 ? 0.05 : 0.005);
                                        return (
                                            <span
                                                key={k}
                                                className={`h-4 w-0.5 rounded-sm ${off ? 'bg-[var(--st-bg-muted)]' : s.status === 'degraded' ? 'bg-[var(--st-bg-muted)]' : 'bg-[var(--st-bg-muted)]/60'}`}
                                            />
                                        );
                                    })}
                                </div>
                                <span className={`min-w-[60px] text-right text-[12px] font-semibold ${
                                    s.status === 'operational' ? 'text-[var(--st-text)]' : s.status === 'degraded' ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'
                                }`}>
                                    {s.uptime}%
                                </span>
                            </div>
                        </m.div>
                    ))}
                </div>
                <p className="mt-4 text-[12px] text-[var(--st-text)]">Each bar represents one day in the last 60 days. Green = operational, amber = degraded, red = outage.</p>
            </SectionWrap>

            {/* Incident history */}
            <SectionWrap bg="white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--st-text)]">Incident history</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-[var(--st-text)] md:text-5xl">
                    Last 30 days, written like we&apos;d want to read.
                </h2>
                <div className="mt-10 space-y-6">
                    {INCIDENTS.map((inc, i) => (
                        <m.div key={inc.date} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-6">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-[var(--st-text)]">{inc.date}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                    inc.status === 'resolved' ? 'bg-[var(--st-bg-muted)] text-[var(--st-text)]' : 'bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                                }`}>{inc.status}</span>
                            </div>
                            <h3 className="mt-2 text-xl font-semibold text-[var(--st-text)]">{inc.title}</h3>
                            <ol className="mt-4 space-y-2">
                                {inc.timeline.map((t) => (
                                    <li key={t.t} className="flex items-center gap-3 text-[13px]">
                                        <Clock className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                                        <span className="font-mono text-[var(--st-text)]">{t.t}</span>
                                        <span className="text-[var(--st-text)]">{t.what}</span>
                                    </li>
                                ))}
                            </ol>
                        </m.div>
                    ))}
                </div>
            </SectionWrap>
        </MarketingShell>
    );
}
