'use client';

import { m } from 'motion/react';
import { useRouter } from 'next/navigation';
import {
    ArrowRight,
    Shield,
    Lock,
    Globe2,
    Key,
    Database,
    Webhook,
    BarChart3,
    UserCheck,
    AlertTriangle,
    Activity,
} from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';
import { Button, Card } from '@/components/sabcrm/20ui';

const CERTS = [
    { name: 'SOC 2 Type II', desc: 'Annual audit by an independent firm. Report on request under NDA.' },
    { name: 'ISO 27001', desc: 'Information security management, certified.' },
    { name: 'DPDP (India)', desc: 'Data Protection and Digital Privacy compliance toolkit, built in.' },
    { name: 'GDPR (EU)', desc: 'DSR workflows, data residency in the EU, DPA available.' },
    { name: 'HIPAA-ready', desc: 'BAA available for Scale and up plans serving US healthcare.' },
    { name: 'PCI DSS', desc: 'Card data tokenised, we never store PANs.' },
];

const PILLARS = [
    { icon: Lock, t: 'Encryption everywhere', d: 'AES-256 at rest, TLS 1.3 in transit, BYO-KMS / HSM on Enterprise.' },
    { icon: Globe2, t: 'Region pinning', d: 'Choose IN / EU / US. Data never leaves the region, backups too.' },
    { icon: Key, t: 'Encrypted document vault', d: 'SabFiles Vault encrypts sensitive files in your browser — zero-knowledge, with access controls and a full audit trail.' },
    { icon: UserCheck, t: 'SSO + SCIM', d: 'SAML, OIDC, group provisioning. Per-module and per-env roles.' },
    { icon: Database, t: 'Backups + restore', d: 'Daily snapshots, configurable retention, point-in-time restore.' },
    { icon: Webhook, t: 'Signed webhooks', d: 'HMAC + timestamp, replay protection, audit log per event.' },
    { icon: BarChart3, t: 'Audit log', d: 'Every action signed, searchable, exportable, immutable.' },
    { icon: AlertTriangle, t: 'Anomaly detection', d: 'Behavioural alerts on suspicious reads, exports, role changes.' },
    { icon: Activity, t: 'Penetration testing', d: 'Quarterly external pentest. Reports and remediation on file.' },
];

const PRACTICES = [
    'All employees go through annual security training and a background check',
    'Production access requires hardware MFA and a reviewed PR',
    'No customer data in non-prod environments without explicit consent',
    'Vendor risk assessment for every sub-processor',
    'Bug bounty program with HackerOne, average payout 40k rupees',
    'Disaster recovery plan tested quarterly, RPO 1h, RTO 4h',
];

export function SecurityClient({ session }: { session?: { user?: unknown } | null }) {
    const router = useRouter();

    return (
        <MarketingShell session={session}>
            <PageHero
                kicker="Security, trust, compliance"
                title={<>Built to be <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">audited.</span></>}
                subtitle="SabNode runs sensitive payroll, customer data, and financial records, and treats that responsibility seriously. Here is exactly what we do."
                extra={
                    <Button variant="primary" iconRight={ArrowRight} onClick={() => router.push('/contact')}>
                        Request security report
                    </Button>
                }
            />

            {/* CERTS */}
            <SectionWrap>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--st-text-tertiary)]">Certifications</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-[var(--st-text)] md:text-5xl">
                    Audited, signed, available on request.
                </h2>
                <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {CERTS.map((c, i) => (
                        <m.div
                            key={c.name}
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.04 }}
                        >
                            <Card variant="outlined" padding="md">
                                <div className="grid h-11 w-11 place-items-center rounded-[var(--st-radius)] bg-gradient-to-br from-emerald-400 to-teal-500 shadow-md">
                                    <Shield className="h-5 w-5 text-white" aria-hidden="true" />
                                </div>
                                <h3 className="mt-4 text-lg font-semibold text-[var(--st-text)]">{c.name}</h3>
                                <p className="mt-1 text-[13px] leading-relaxed text-[var(--st-text-secondary)]">{c.desc}</p>
                            </Card>
                        </m.div>
                    ))}
                </div>
            </SectionWrap>

            {/* PILLARS */}
            <SectionWrap bg="white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--st-text-tertiary)]">9 pillars</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-[var(--st-text)] md:text-5xl">
                    The security posture, in plain English.
                </h2>
                <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {PILLARS.map((p, i) => {
                        const Icon = p.icon;
                        return (
                            <m.div
                                key={p.t}
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                            >
                                <Card variant="outlined" padding="md" className="bg-[var(--st-bg-secondary)]">
                                    <Icon className="h-5 w-5 text-[var(--st-accent)]" aria-hidden="true" />
                                    <h3 className="mt-3 text-base font-semibold text-[var(--st-text)]">{p.t}</h3>
                                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--st-text-secondary)]">{p.d}</p>
                                </Card>
                            </m.div>
                        );
                    })}
                </div>
            </SectionWrap>

            {/* PRACTICES */}
            <SectionWrap>
                <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr]">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--st-text-tertiary)]">Operational</p>
                        <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-[var(--st-text)]">
                            The boring stuff we don&apos;t cut corners on.
                        </h2>
                    </div>
                    <ul className="space-y-2">
                        {PRACTICES.map((p, i) => (
                            <m.li
                                key={p}
                                initial={{ opacity: 0, x: -4 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                            >
                                <Card variant="outlined" padding="sm" className="flex items-start gap-3">
                                    <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-[var(--st-accent)]" aria-hidden="true" />
                                    <span className="text-[15px] text-[var(--st-text)]">{p}</span>
                                </Card>
                            </m.li>
                        ))}
                    </ul>
                </div>
            </SectionWrap>

            {/* CTA */}
            <SectionWrap>
                <m.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="relative overflow-hidden rounded-3xl bg-zinc-950 px-8 py-16 text-white md:px-16"
                >
                    <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/45 blur-3xl" />
                    <h2 className="relative text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                        Talk to security, not sales.
                    </h2>
                    <p className="relative mt-4 max-w-2xl text-base text-white/70">
                        We&apos;ll send you our SOC 2 report, pentest summary, and DPA under NDA, same day.
                    </p>
                    <div className="relative mt-8">
                        <Button variant="gradient" iconRight={ArrowRight} onClick={() => router.push('/contact')}>
                            Request reports
                        </Button>
                    </div>
                </m.div>
            </SectionWrap>
        </MarketingShell>
    );
}
