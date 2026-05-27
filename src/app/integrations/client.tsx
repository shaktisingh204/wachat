'use client';

import { m } from 'motion/react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, Check, Search, Webhook, Zap, Code, type LucideIcon } from 'lucide-react';
import { MarketingShell, PageHero, SectionWrap } from '@/components/landing-v2/marketing-shell';

interface Integration {
    name: string;
    cat: string;
    blurb: string;
}

const CATEGORIES = ['All', 'Communication', 'Payments', 'Commerce', 'Marketing', 'AI', 'Data', 'Productivity', 'Developer', 'Identity'];

const INTEGRATIONS: Integration[] = [
    // Communication
    { name: 'WhatsApp Business API', cat: 'Communication', blurb: 'Send/receive templates, broadcast, chatbot.' },
    { name: 'Twilio', cat: 'Communication', blurb: 'SMS + voice fallback routes.' },
    { name: 'Gmail', cat: 'Communication', blurb: 'Two-way inbox + send via OAuth.' },
    { name: 'Outlook', cat: 'Communication', blurb: 'Microsoft 365 mailbox sync.' },
    { name: 'Slack', cat: 'Communication', blurb: 'Notifications, slash commands, paging.' },
    { name: 'Telegram', cat: 'Communication', blurb: 'Bots, channels, groups, payments.' },
    { name: 'Discord', cat: 'Communication', blurb: 'Webhook posts + slash bots.' },
    { name: 'Zoom', cat: 'Communication', blurb: 'Auto-create meetings + transcripts.' },
    // Payments
    { name: 'Razorpay', cat: 'Payments', blurb: 'UPI, cards, EMI, subscriptions.' },
    { name: 'Stripe', cat: 'Payments', blurb: 'Global cards + subs + connect.' },
    { name: 'Cashfree', cat: 'Payments', blurb: 'UPI + payouts API.' },
    { name: 'PayPal', cat: 'Payments', blurb: 'Express checkout + webhooks.' },
    { name: 'PhonePe', cat: 'Payments', blurb: 'UPI deep links + recon.' },
    // Commerce
    { name: 'Shopify', cat: 'Commerce', blurb: 'Sync orders, customers, products.' },
    { name: 'WooCommerce', cat: 'Commerce', blurb: 'Order + cart-abandon events.' },
    { name: 'Magento', cat: 'Commerce', blurb: 'Bulk catalog sync.' },
    { name: 'Delhivery', cat: 'Commerce', blurb: 'Live courier rates + waybills.' },
    { name: 'Shiprocket', cat: 'Commerce', blurb: 'Multi-carrier shipping ops.' },
    { name: 'Razorpay Magic', cat: 'Commerce', blurb: '1-click checkout.' },
    // Marketing
    { name: 'Meta Ads', cat: 'Marketing', blurb: 'Custom audiences + CAPI.' },
    { name: 'Google Ads', cat: 'Marketing', blurb: 'Conversion uploads + audiences.' },
    { name: 'TikTok Ads', cat: 'Marketing', blurb: 'Events API + lead forms.' },
    { name: 'Mailchimp', cat: 'Marketing', blurb: 'Two-way contact sync.' },
    { name: 'HubSpot', cat: 'Marketing', blurb: 'Deal + contact mirror.' },
    { name: 'Salesforce', cat: 'Marketing', blurb: 'Bidirectional CRM sync.' },
    // AI
    { name: 'OpenAI', cat: 'AI', blurb: 'GPT-4, embeddings, tool-use.' },
    { name: 'Anthropic', cat: 'AI', blurb: 'Claude models + structured output.' },
    { name: 'Google Gemini', cat: 'AI', blurb: 'Multi-modal + grounding.' },
    { name: 'Ollama', cat: 'AI', blurb: 'Local model runtime.' },
    { name: 'Pinecone', cat: 'AI', blurb: 'Vector store for RAG.' },
    { name: 'Weaviate', cat: 'AI', blurb: 'Embedding + hybrid search.' },
    // Data
    { name: 'Postgres', cat: 'Data', blurb: 'Native connector + signed reads.' },
    { name: 'MongoDB', cat: 'Data', blurb: 'Collection sync + watch.' },
    { name: 'MySQL', cat: 'Data', blurb: 'Read replica + writeback.' },
    { name: 'BigQuery', cat: 'Data', blurb: 'Scheduled exports + queries.' },
    { name: 'Snowflake', cat: 'Data', blurb: 'Warehouse pushdown.' },
    { name: 'Redshift', cat: 'Data', blurb: 'Bulk loads + ad-hoc.' },
    { name: 'AWS S3', cat: 'Data', blurb: 'Bucket sync + presigned URLs.' },
    { name: 'Cloudflare R2', cat: 'Data', blurb: 'Egress-free object store.' },
    // Productivity
    { name: 'Google Calendar', cat: 'Productivity', blurb: 'Two-way calendar + bookings.' },
    { name: 'Notion', cat: 'Productivity', blurb: 'Database read/write.' },
    { name: 'Linear', cat: 'Productivity', blurb: 'Issue mirror + status.' },
    { name: 'Jira', cat: 'Productivity', blurb: 'Project + sprint sync.' },
    { name: 'Asana', cat: 'Productivity', blurb: 'Task + project sync.' },
    { name: 'Google Sheets', cat: 'Productivity', blurb: 'Bidirectional sheet sync.' },
    // Developer
    { name: 'GitHub', cat: 'Developer', blurb: 'PR + issue events.' },
    { name: 'GitLab', cat: 'Developer', blurb: 'CI + MR events.' },
    { name: 'Vercel', cat: 'Developer', blurb: 'Deploy events + logs.' },
    { name: 'PagerDuty', cat: 'Developer', blurb: 'Incident paging.' },
    { name: 'Datadog', cat: 'Developer', blurb: 'Metrics + alerts mirror.' },
    { name: 'Sentry', cat: 'Developer', blurb: 'Error stream + grouping.' },
    // Identity
    { name: 'Okta', cat: 'Identity', blurb: 'SAML SSO + SCIM.' },
    { name: 'Azure AD', cat: 'Identity', blurb: 'Entra ID + groups.' },
    { name: 'Google Workspace', cat: 'Identity', blurb: 'OAuth + directory.' },
    { name: 'Auth0', cat: 'Identity', blurb: 'OIDC + social logins.' },
];

export function IntegrationsClient({ session }: { session?: { user?: unknown } | null }) {
    const [tab, setTab] = useState<string>('All');
    const [q, setQ] = useState('');

    const visible = useMemo(() => {
        let out = INTEGRATIONS;
        if (tab !== 'All') out = out.filter((i) => i.cat === tab);
        if (q.trim()) {
            const term = q.toLowerCase();
            out = out.filter((i) => i.name.toLowerCase().includes(term) || i.blurb.toLowerCase().includes(term));
        }
        return out;
    }, [tab, q]);

    return (
        <MarketingShell session={session}>
            <PageHero
                kicker="900+ integrations · 0 setup fees"
                title={<>Connect SabNode to <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">everything else.</span></>}
                subtitle="Native connectors for the apps your team already uses. Webhooks and a clean REST API for everything else."
                extra={
                    <div className="mx-auto flex max-w-md items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 shadow-sm">
                        <Search className="h-4 w-4 text-zinc-400" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search integrations…"
                            className="w-full bg-transparent text-sm focus:outline-none"
                        />
                    </div>
                }
            />

            {/* Category tabs */}
            <SectionWrap>
                <div className="flex flex-wrap justify-center gap-1.5">
                    {CATEGORIES.map((c) => (
                        <button
                            key={c}
                            onClick={() => setTab(c)}
                            className="relative rounded-full px-3.5 py-1.5 text-[12px] font-medium transition"
                        >
                            {tab === c && (
                                <m.span
                                    layoutId="int-tab"
                                    className="absolute inset-0 rounded-full bg-zinc-900"
                                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                />
                            )}
                            <span className={`relative z-10 ${tab === c ? 'text-white' : 'text-zinc-600 hover:text-zinc-900'}`}>
                                {c}
                                <span className={`ml-1.5 text-[10px] ${tab === c ? 'text-white/60' : 'text-zinc-400'}`}>
                                    {c === 'All' ? INTEGRATIONS.length : INTEGRATIONS.filter((i) => i.cat === c).length}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>

                <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {visible.map((it, i) => (
                        <m.div
                            key={it.name}
                            initial={{ opacity: 0, y: 6 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: Math.min(i * 0.02, 0.3) }}
                            className="group rounded-2xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-zinc-900"
                        >
                            <div className="flex items-center gap-3">
                                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 text-sm font-bold text-zinc-900">
                                    {it.name[0]}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="truncate text-sm font-semibold text-zinc-950">{it.name}</span>
                                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                    </div>
                                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                                        {it.cat}
                                    </span>
                                </div>
                            </div>
                            <p className="mt-3 text-[13px] leading-relaxed text-zinc-600">{it.blurb}</p>
                        </m.div>
                    ))}
                </div>
            </SectionWrap>

            {/* Build your own */}
            <SectionWrap bg="white">
                <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Build your own</p>
                        <h2 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-zinc-950 md:text-5xl">
                            Don&apos;t see your tool? Build it in 20 minutes.
                        </h2>
                        <p className="mt-4 text-lg text-zinc-600">
                            Every action is exposed as a clean REST + webhook API. Use SabFlow&apos;s HTTP node, drop
                            in your auth, and your custom integration is live.
                        </p>
                        <div className="mt-6 space-y-2">
                            {[
                                { icon: Webhook, t: 'Signed webhooks with HMAC + replay protection', },
                                { icon: Zap, t: 'Built-in retries, idempotency, dead-letter queue' },
                                { icon: Code, t: 'SDKs for Node, Python, Go, Bun, Deno' },
                            ].map((p) => {
                                const Icon = p.icon;
                                return (
                                    <div key={p.t} className="flex items-center gap-2 text-[14px] text-zinc-700">
                                        <Icon className="h-4 w-4 text-amber-600" />
                                        {p.t}
                                    </div>
                                );
                            })}
                        </div>
                        <Link href="/api-docs" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                            Read the API reference <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-950 font-mono text-[12px] leading-relaxed text-zinc-100">
                        <div className="border-b border-white/10 px-4 py-2 text-[11px] text-white/60">POST /v1/integrations/run</div>
                        <pre className="p-4">{`curl https://api.sabnode.in/v1/integrations/run \\
  -H "Authorization: Bearer $SAB_KEY" \\
  -H "Idempotency-Key: evt_4f7e" \\
  -d '{
    "app": "razorpay",
    "action": "payment.captured",
    "payload": { "id": "pay_NaR..." }
  }'`}</pre>
                    </div>
                </div>
            </SectionWrap>
        </MarketingShell>
    );
}
