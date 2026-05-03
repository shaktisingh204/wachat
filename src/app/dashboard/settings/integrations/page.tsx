'use client';

import { useState } from 'react';
import {
    LuSlack,
    LuGithub,
    LuZap,
    LuDatabase,
    LuShoppingCart,
    LuMail,
    LuSearch,
    LuCheck,
} from 'react-icons/lu';

import {
    ClayBadge,
    ClayBreadcrumbs,
    ClayButton,
    ClayCard,
    ClayInput,
    ClaySectionHeader,
} from '@/components/clay';

type Integration = {
    id: string;
    name: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    category: 'messaging' | 'data' | 'automation' | 'commerce' | 'dev';
    connected: boolean;
};

const INTEGRATIONS: Integration[] = [
    {
        id: 'slack',
        name: 'Slack',
        description: 'Stream inbox events into a Slack channel for fast team triage.',
        icon: LuSlack,
        category: 'messaging',
        connected: false,
    },
    {
        id: 'zapier',
        name: 'Zapier',
        description: 'Connect SabNode to 6,000+ apps with no-code automations.',
        icon: LuZap,
        category: 'automation',
        connected: true,
    },
    {
        id: 'github',
        name: 'GitHub',
        description: 'Mirror your SabNode release notes to a GitHub repo.',
        icon: LuGithub,
        category: 'dev',
        connected: false,
    },
    {
        id: 'shopify',
        name: 'Shopify',
        description: 'Sync order events into WhatsApp broadcasts and abandoned-cart flows.',
        icon: LuShoppingCart,
        category: 'commerce',
        connected: false,
    },
    {
        id: 'bigquery',
        name: 'BigQuery',
        description: 'Stream raw message logs into your BigQuery warehouse for analysis.',
        icon: LuDatabase,
        category: 'data',
        connected: false,
    },
    {
        id: 'mailchimp',
        name: 'Mailchimp',
        description: 'Sync contact lists and segments between SabNode and Mailchimp.',
        icon: LuMail,
        category: 'messaging',
        connected: false,
    },
];

const CATEGORIES: Array<{ id: Integration['category'] | 'all'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'messaging', label: 'Messaging' },
    { id: 'automation', label: 'Automation' },
    { id: 'commerce', label: 'Commerce' },
    { id: 'data', label: 'Data' },
    { id: 'dev', label: 'Developer' },
];

export default function IntegrationsPage() {
    const [filter, setFilter] = useState<Integration['category'] | 'all'>('all');
    const [search, setSearch] = useState('');

    const visible = INTEGRATIONS.filter(
        (i) =>
            (filter === 'all' || i.category === filter) &&
            (!search || i.name.toLowerCase().includes(search.toLowerCase())),
    );

    return (
        <div className="clay-enter flex min-h-full flex-col gap-6">
            <ClayBreadcrumbs
                items={[
                    { label: 'Settings', href: '/dashboard/settings' },
                    { label: 'Integrations' },
                ]}
            />

            <ClaySectionHeader
                size="lg"
                title="Integrations"
                subtitle="Plug SabNode into the tools your team already uses."
            />

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1 rounded-full border border-border bg-card p-1">
                    {CATEGORIES.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => setFilter(c.id)}
                            className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                                filter === c.id
                                    ? 'bg-foreground text-white'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
                <div className="ml-auto w-full sm:w-64">
                    <ClayInput
                        placeholder="Search integrations…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        leading={<LuSearch className="h-4 w-4" />}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((i) => (
                    <ClayCard key={i.id} padded className="flex flex-col gap-3">
                        <div className="flex items-start justify-between">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 text-foreground">
                                <i.icon className="h-5 w-5" />
                            </div>
                            {i.connected ? (
                                <ClayBadge tone="green" dot>
                                    Connected
                                </ClayBadge>
                            ) : (
                                <ClayBadge tone="neutral">Available</ClayBadge>
                            )}
                        </div>
                        <div>
                            <p className="text-[14px] font-semibold text-foreground">{i.name}</p>
                            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                                {i.description}
                            </p>
                        </div>
                        <div className="mt-auto">
                            {i.connected ? (
                                <ClayButton
                                    variant="ghost"
                                    size="sm"
                                    leading={<LuCheck className="h-4 w-4" />}
                                >
                                    Manage
                                </ClayButton>
                            ) : (
                                <ClayButton variant="obsidian" size="sm">
                                    Connect
                                </ClayButton>
                            )}
                        </div>
                    </ClayCard>
                ))}
            </div>

            {visible.length === 0 && (
                <ClayCard padded className="py-10 text-center">
                    <p className="text-[13px] font-semibold text-foreground">No integrations match</p>
                    <p className="mt-1 text-[12.5px] text-muted-foreground">
                        Try a different search or category.
                    </p>
                </ClayCard>
            )}
        </div>
    );
}
