'use client';

import { m } from 'motion/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Code, Shield, Webhook, Zap, BookOpen } from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';
import {
    Badge,
    Button,
    Card,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    SegmentedControl,
} from '@/components/sabcrm/20ui';

const LANGS = ['curl', 'node', 'python', 'go'] as const;
type Lang = (typeof LANGS)[number];

const LANG_ITEMS = LANGS.map((value) => ({ value, label: value }));

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

type HttpMethod = 'GET' | 'POST';

const ENDPOINTS: Array<{ method: HttpMethod; path: string; desc: string }> = [
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
    { icon: Shield, t: 'Signed everything', d: 'Bearer tokens plus HMAC on webhooks. Every payload tamper-evident.' },
    { icon: Zap, t: 'Idempotent by default', d: 'Pass an Idempotency-Key on every write. Safe to retry.' },
    { icon: Webhook, t: 'Webhooks with replay', d: 'Timestamps, signing, and replay protection. Subscribe per event.' },
    { icon: Code, t: 'Typed SDKs', d: 'First-class libraries for Node, Python, Go, Bun, Deno.' },
];

const RELATED = [
    { icon: BookOpen, t: 'Full reference', d: 'Every endpoint, parameter, error code.', href: '#' },
    { icon: Webhook, t: 'Webhook guide', d: 'Signing, replay, delivery guarantees.', href: '#' },
    { icon: Code, t: 'SDKs on GitHub', d: 'Node, Python, Go, Bun, Deno.', href: '#' },
];

export function ApiDocsClient({ session }: { session?: { user?: unknown } | null }) {
    const router = useRouter();
    const [lang, setLang] = useState<Lang>('curl');
    const apiKeyHref = session?.user ? '/dashboard/api-keys' : '/login?signup=1';

    return (
        <MarketingShell session={session}>
            <PageHero
                kicker="API reference, v1"
                title="A clean REST API for every module."
                subtitle="Signed, idempotent, versioned. Hit /v1 from anywhere, your CRM, your dashboards, your bots."
                extra={
                    <span className="ui20 inline-flex">
                        <Button
                            variant="primary"
                            iconRight={ArrowRight}
                            onClick={() => router.push(apiKeyHref)}
                        >
                            Get your API key
                        </Button>
                    </span>
                }
            />

            {/* Code sample with language tabs */}
            <SectionWrap>
                <div className="ui20">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--st-text-secondary)]">
                        Hello, SabNode
                    </p>
                    <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-[var(--st-text)] md:text-5xl">
                        Make your first API call in 30 seconds.
                    </h2>

                    <m.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mt-10 overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)]"
                    >
                        <div className="flex items-center gap-3 border-b border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2">
                            <SegmentedControl
                                items={LANG_ITEMS}
                                value={lang}
                                onChange={(value) => setLang(value as Lang)}
                                size="sm"
                                aria-label="Code sample language"
                            />
                            <Badge tone="success" kind="soft" className="ml-auto">
                                200 OK
                            </Badge>
                        </div>
                        <pre className="overflow-x-auto bg-[var(--st-text)] px-6 py-5 font-mono text-[12.5px] leading-relaxed text-[var(--st-text-inverted)]">
                            {SAMPLES[lang]}
                        </pre>
                    </m.div>
                </div>
            </SectionWrap>

            {/* Features */}
            <SectionWrap bg="white">
                <div className="ui20 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {FEATURES.map((f, i) => {
                        const Icon = f.icon;
                        return (
                            <m.div
                                key={f.t}
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.04 }}
                            >
                                <Card variant="outlined" padding="md" className="h-full">
                                    <Icon className="h-5 w-5 text-[var(--st-accent)]" aria-hidden="true" />
                                    <p className="mt-3 text-base font-semibold text-[var(--st-text)]">{f.t}</p>
                                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--st-text-secondary)]">{f.d}</p>
                                </Card>
                            </m.div>
                        );
                    })}
                </div>
            </SectionWrap>

            {/* Endpoint list */}
            <SectionWrap>
                <div className="ui20">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--st-text-secondary)]">
                        Common endpoints
                    </p>
                    <h2 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-[var(--st-text)] md:text-5xl">
                        The most-used REST endpoints.
                    </h2>
                    <m.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="mt-10 overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)]"
                    >
                        <Table hover>
                            <THead>
                                <Tr>
                                    <Th width={120}>Method</Th>
                                    <Th>Path</Th>
                                    <Th>Description</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {ENDPOINTS.map((e) => (
                                    <Tr key={`${e.method} ${e.path}`}>
                                        <Td>
                                            <Badge tone={e.method === 'GET' ? 'info' : 'accent'} kind="soft">
                                                {e.method}
                                            </Badge>
                                        </Td>
                                        <Td>
                                            <span className="font-mono text-[12.5px] text-[var(--st-text)]">{e.path}</span>
                                        </Td>
                                        <Td>
                                            <span className="text-[13px] text-[var(--st-text-secondary)]">{e.desc}</span>
                                        </Td>
                                    </Tr>
                                ))}
                            </TBody>
                        </Table>
                    </m.div>
                    <p className="mt-6 text-sm text-[var(--st-text-secondary)]">
                        All endpoints versioned under /v1. Breaking changes ship as /v2 with at least 6 months overlap.
                    </p>
                </div>
            </SectionWrap>

            {/* Related */}
            <SectionWrap bg="white">
                <div className="ui20 grid grid-cols-1 gap-4 md:grid-cols-3">
                    {RELATED.map((c, i) => {
                        const Icon = c.icon;
                        return (
                            <m.div
                                key={c.t}
                                initial={{ opacity: 0, y: 8 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <Link href={c.href} className="block h-full">
                                    <Card variant="interactive" padding="lg" className="h-full">
                                        <Icon className="h-5 w-5 text-[var(--st-accent)]" aria-hidden="true" />
                                        <p className="mt-3 text-lg font-semibold text-[var(--st-text)]">{c.t}</p>
                                        <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">{c.d}</p>
                                    </Card>
                                </Link>
                            </m.div>
                        );
                    })}
                </div>
            </SectionWrap>
        </MarketingShell>
    );
}
