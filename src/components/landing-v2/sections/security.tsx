'use client';

import { m } from 'motion/react';
import { ShieldCheck, KeyRound, Lock, Globe2, FileCheck2, ScrollText } from 'lucide-react';

const badges = [
    { label: 'SOC 2 Type II', sub: 'Audit in progress', icon: ShieldCheck },
    { label: 'GDPR + India DPDP', sub: 'Toolkit shipped', icon: ScrollText },
    { label: 'SSO — SAML / OIDC', sub: 'Enterprise plan', icon: KeyRound },
    { label: 'SCIM provisioning', sub: 'Automated joiner / leaver', icon: FileCheck2 },
    { label: 'EU / IN / US residency', sub: 'On request', icon: Globe2 },
    { label: 'Encrypted at rest', sub: 'Per-tenant CMK ready', icon: Lock },
];

export function Security() {
    return (
        <section className="relative overflow-hidden py-32">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(16,185,129,0.08), transparent 60%)',
                }}
            />
            <div className="relative mx-auto max-w-7xl px-6">
                <m.div
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mx-auto max-w-3xl text-center"
                >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                        Enterprise-ready
                    </p>
                    <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl md:text-6xl">
                        Built for teams that take trust seriously.
                    </h2>
                    <p className="mt-5 text-pretty text-lg text-zinc-600">
                        Single sign-on, automated provisioning, regional data residency, full audit log,
                        one-click data export — the controls IT actually asks for.
                    </p>
                </m.div>

                <div className="mx-auto mt-16 max-w-5xl divide-y divide-zinc-200/70">
                    {badges.map((b, i) => {
                        const Icon = b.icon;
                        return (
                            <m.div
                                key={b.label}
                                initial={{ opacity: 0, x: -10 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                                className="group flex items-center gap-5 py-5"
                            >
                                <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-200/70 transition group-hover:ring-emerald-300">
                                    <Icon className="h-5 w-5 text-emerald-700" />
                                </span>
                                <div className="flex-1">
                                    <div className="text-base font-medium text-zinc-900">{b.label}</div>
                                    <div className="text-sm text-zinc-500">{b.sub}</div>
                                </div>
                                <span className="hidden text-xs font-medium uppercase tracking-wider text-emerald-600 sm:inline">
                                    Available
                                </span>
                            </m.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
