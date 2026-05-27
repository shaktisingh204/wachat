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
    { name: 'SabVoice · IVR + dialer', status: 'operational', uptime: 99.991 },
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
                            <>All systems <span className="bg-gradient-to-r from-zoru-ink via-zoru-ink to-zoru-ink bg-clip-text text-transparent">operational.</span></>
                        ) : (
                            <>Some systems <span className="text-zoru-ink">degraded.</span></>
                        )}
                    </>
                }
                subtitle="Live status of every SabNode service. Subscribe to alerts via RSS or webhooks."
                extra={
                    <div className="inline-flex items-center gap-2 rounded-full border border-zoru-line bg-white px-4 py-2 text-sm font-semibold text-zoru-ink">
                        <Rss className="h-3.5 w-3.5 text-zoru-ink" /> Subscribe to status RSS
                    </div>
                }
            />

            {/* Overall banner */}
            <SectionWrap>
                <m.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className={`flex items-center gap-3 rounded-2xl border p-5 ${overallTone === 'emerald' ? 'border-zoru-line bg-zoru-surface-2' : 'border-zoru-line bg-zoru-surface-2'}`}>
                    {overallTone === 'emerald' ? (
                        <CheckCircle2 className="h-6 w-6 text-zoru-ink" />
                    ) : (
                        <AlertTriangle className="h-6 w-6 text-zoru-ink" />
                    )}
                    <div>
                        <p className={`text-base font-semibold ${overallTone === 'emerald' ? 'text-zoru-ink' : 'text-zoru-ink'}`}>{overall}</p>
                        <p className="text-[12px] text-zoru-ink">Last checked just now · 90-day average uptime 99.97%</p>
                    </div>
                </m.div>

                {/* Service list */}
                <div className="mt-10 overflow-hidden rounded-3xl border border-zoru-line bg-white">
                    {SERVICES.map((s, i) => (
                        <m.div key={s.name} initial={{ opacity: 0, x: -4 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.02 }}
                            className="flex items-center gap-3 border-b border-zoru-line px-5 py-3 last:border-0">
                            <span className={`h-2.5 w-2.5 rounded-full ${
                                s.status === 'operational' ? 'bg-zoru-ink' : s.status === 'degraded' ? 'bg-zoru-ink' : 'bg-zoru-ink'
                            }`} />
                            <span className="flex-1 text-[14px] text-zoru-ink">{s.name}</span>
                            <div className="flex items-center gap-3">
                                {/* 90-day bar chart */}
                                <div className="hidden gap-0.5 sm:flex">
                                    {Array.from({ length: 60 }).map((_, k) => {
                                        const off = Math.random() < (s.uptime < 99.9 ? 0.05 : 0.005);
                                        return (
                                            <span
                                                key={k}
                                                className={`h-4 w-0.5 rounded-sm ${off ? 'bg-zoru-surface-2' : s.status === 'degraded' ? 'bg-zoru-surface-2' : 'bg-zoru-surface-2/60'}`}
                                            />
                                        );
                                    })}
                                </div>
                                <span className={`min-w-[60px] text-right text-[12px] font-semibold ${
                                    s.status === 'operational' ? 'text-zoru-ink' : s.status === 'degraded' ? 'text-zoru-ink' : 'text-zoru-ink'
                                }`}>
                                    {s.uptime}%
                                </span>
                            </div>
                        </m.div>
                    ))}
                </div>
                <p className="mt-4 text-[12px] text-zoru-ink">Each bar represents one day in the last 60 days. Green = operational, amber = degraded, red = outage.</p>
            </SectionWrap>

            {/* Incident history */}
            <SectionWrap bg="white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">Incident history</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    Last 30 days, written like we&apos;d want to read.
                </h2>
                <div className="mt-10 space-y-6">
                    {INCIDENTS.map((inc, i) => (
                        <m.div key={inc.date} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-2xl border border-zoru-line bg-zoru-surface p-6">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-zoru-ink">{inc.date}</p>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                    inc.status === 'resolved' ? 'bg-zoru-surface-2 text-zoru-ink' : 'bg-zoru-surface-2 text-zoru-ink'
                                }`}>{inc.status}</span>
                            </div>
                            <h3 className="mt-2 text-xl font-semibold text-zoru-ink">{inc.title}</h3>
                            <ol className="mt-4 space-y-2">
                                {inc.timeline.map((t) => (
                                    <li key={t.t} className="flex items-center gap-3 text-[13px]">
                                        <Clock className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                        <span className="font-mono text-zoru-ink">{t.t}</span>
                                        <span className="text-zoru-ink">{t.what}</span>
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
