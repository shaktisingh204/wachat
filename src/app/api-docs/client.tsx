'use client';

import { m } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Code, Shield, Webhook, Zap, BookOpen } from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';

const LANGS = ['curl', 'node', 'python', 'go'] as const;
type Lang = (typeof LANGS)[number];

const SAMPLES: Record<Lang, string> = {
    curl: `curl https://api.sabnode.in/v1/contacts \\
  -H "Authorization: Bearer $SAB_KEY" \\
  -H "Idempotency-Key: con_4f7e..." \\
  -d '{
    "name": "Priya Sharma",
    "phone": "+919812345678",
    "tags": ["premium", "diwali-23"]
  }'`,
    node: `import { SabNode } from "sabnode";

const sab = new SabNode({ apiKey: process.env.SAB_KEY! });

await sab.contacts.create({
  name: "Priya Sharma",
  phone: "+919812345678",
  tags: ["premium", "diwali-23"],
}, { idempotencyKey: "con_4f7e..." });`,
    python: `from sabnode import SabNode

sab = SabNode(api_key=os.environ["SAB_KEY"])

sab.contacts.create(
    name="Priya Sharma",
    phone="+919812345678",
    tags=["premium", "diwali-23"],
    idempotency_key="con_4f7e...",
)`,
    go: `import "github.com/sabnode/sabnode-go"

client := sabnode.New(os.Getenv("SAB_KEY"))

_, err := client.Contacts.Create(ctx, &sabnode.ContactInput{
    Name:           "Priya Sharma",
    Phone:          "+919812345678",
    Tags:           []string{"premium", "diwali-23"},
    IdempotencyKey: "con_4f7e...",
})`,
};

const ENDPOINTS = [
    { method: 'POST', path: '/v1/contacts', desc: 'Create or upsert a contact' },
    { method: 'GET', path: '/v1/contacts/{id}', desc: 'Fetch a single contact' },
    { method: 'POST', path: '/v1/messages', desc: 'Send a message on any channel' },
    { method: 'POST', path: '/v1/deals', desc: 'Create a CRM deal' },
    { method: 'POST', path: '/v1/invoices', desc: 'Issue a signed GST invoice' },
    { method: 'POST', path: '/v1/flows/{slug}/trigger', desc: 'Trigger a SabFlow workflow' },
    { method: 'GET', path: '/v1/flows/{slug}/runs', desc: 'List recent runs of a flow' },
    { method: 'POST', path: '/v1/payroll/runs', desc: 'Kick off a payroll run' },
    { method: 'GET', path: '/v1/audit', desc: 'Stream signed audit events' },
];

const FEATURES = [
    { icon: Shield, t: 'Signed everything', d: 'Bearer tokens + HMAC on webhooks. Every payload tamper-evident.' },
    { icon: Zap, t: 'Idempotent by default', d: 'Pass an Idempotency-Key on every write. Safe to retry.' },
    { icon: Webhook, t: 'Webhooks with replay', d: 'Timestamps + signing + replay protection. Subscribe per event.' },
    { icon: Code, t: 'Typed SDKs', d: 'First-class libraries for Node, Python, Go, Bun, Deno.' },
];

export function ApiDocsClient({ session }: { session?: { user?: unknown } | null }) {
    const [lang, setLang] = useState<Lang>('curl');

    return (
        <MarketingShell session={session}>
            <PageHero
                kicker="API reference · v1"
                title={<>A clean REST API for <span className="bg-gradient-to-r from-zoru-ink via-zoru-ink to-zoru-ink bg-clip-text text-transparent">every module.</span></>}
                subtitle="Signed, idempotent, versioned. Hit /v1 from anywhere — your CRM, your dashboards, your bots."
                extra={
                    <Link href={session?.user ? '/dashboard/api-keys' : '/login?signup=1'} className="inline-flex items-center gap-2 rounded-full bg-zoru-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-zoru-ink">
                        Get your API key <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                }
            />

            {/* Code sample with language tabs */}
            <SectionWrap>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">Hello, SabNode</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    Make your first API call in 30 seconds.
                </h2>

                <m.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="mt-10 overflow-hidden rounded-3xl border border-zoru-line">
                    <div className="flex items-center gap-1 border-b border-zoru-line bg-white px-3 py-2">
                        {LANGS.map((l) => (
                            <button key={l} onClick={() => setLang(l)} className="relative rounded-full px-3 py-1 text-[12px] font-semibold transition">
                                {lang === l && <m.span layoutId="lang-tab" className="absolute inset-0 rounded-full bg-zoru-ink" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                                <span className={`relative z-10 ${lang === l ? 'text-white' : 'text-zoru-ink'}`}>{l}</span>
                            </button>
                        ))}
                        <span className="ml-auto rounded-md bg-zoru-surface-2 px-2 py-0.5 text-[10px] font-bold text-zoru-ink">200 OK</span>
                    </div>
                    <pre className="overflow-x-auto bg-zoru-ink px-6 py-5 font-mono text-[12.5px] leading-relaxed text-white">{SAMPLES[lang]}</pre>
                </m.div>
            </SectionWrap>

            {/* Features */}
            <SectionWrap bg="white">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {FEATURES.map((f, i) => {
                        const Icon = f.icon;
                        return (
                            <m.div key={f.t} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                                className="rounded-2xl border border-zoru-line bg-zoru-surface p-5">
                                <Icon className="h-5 w-5 text-zoru-ink" />
                                <p className="mt-3 text-base font-semibold text-zoru-ink">{f.t}</p>
                                <p className="mt-1 text-[13px] leading-relaxed text-zoru-ink">{f.d}</p>
                            </m.div>
                        );
                    })}
                </div>
            </SectionWrap>

            {/* Endpoint list */}
            <SectionWrap>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zoru-ink">Common endpoints</p>
                <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-zoru-ink md:text-5xl">
                    The most-used REST endpoints.
                </h2>
                <div className="mt-10 overflow-hidden rounded-2xl border border-zoru-line bg-white">
                    {ENDPOINTS.map((e, i) => (
                        <m.div key={e.path} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                            transition={{ delay: i * 0.03 }}
                            className="grid grid-cols-12 items-center gap-3 border-b border-zoru-line px-5 py-3 last:border-0 hover:bg-zoru-surface-2">
                            <span className={`col-span-2 rounded-md px-2 py-0.5 text-center text-[10px] font-bold ${
                                e.method === 'GET' ? 'bg-zoru-surface-2 text-zoru-ink' : 'bg-zoru-surface-2 text-zoru-ink'
                            }`}>{e.method}</span>
                            <span className="col-span-5 font-mono text-[12.5px] text-zoru-ink">{e.path}</span>
                            <span className="col-span-5 text-[13px] text-zoru-ink">{e.desc}</span>
                        </m.div>
                    ))}
                </div>
                <p className="mt-6 text-sm text-zoru-ink">All endpoints versioned under /v1 — breaking changes ship as /v2 with at least 6 months overlap.</p>
            </SectionWrap>

            {/* Related */}
            <SectionWrap bg="white">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {[
                        { icon: BookOpen, t: 'Full reference', d: 'Every endpoint, parameter, error code.', href: '#' },
                        { icon: Webhook, t: 'Webhook guide', d: 'Signing, replay, delivery guarantees.', href: '#' },
                        { icon: Code, t: 'SDKs on GitHub', d: 'Node, Python, Go, Bun, Deno.', href: '#' },
                    ].map((c, i) => {
                        const Icon = c.icon;
                        return (
                            <m.div key={c.t} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}>
                                <Link href={c.href} className="block rounded-2xl border border-zoru-line bg-zoru-surface p-6 transition hover:-translate-y-1 hover:border-zoru-line">
                                    <Icon className="h-5 w-5 text-zoru-ink" />
                                    <p className="mt-3 text-lg font-semibold text-zoru-ink">{c.t}</p>
                                    <p className="mt-1 text-[13px] text-zoru-ink">{c.d}</p>
                                </Link>
                            </m.div>
                        );
                    })}
                </div>
            </SectionWrap>
        </MarketingShell>
    );
}
