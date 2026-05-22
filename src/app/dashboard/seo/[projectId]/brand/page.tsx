'use client';

import { Button, Card, ZoruCardContent, ZoruCardDescription, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  use } from 'react';

import { Radar, Bell } from 'lucide-react';

export default function BrandPage({ params }: { params: Promise<{ projectId: string }> }) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projectId } = use(params);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                        <Radar className="h-8 w-8 text-zoru-ink" />
                        Brand Radar
                    </h1>
                    <p className="text-zoru-ink-muted mt-1">Monitor sentiment and unlinked mentions across the web.</p>
                </div>
                <ZoruButton variant="outline">
                    <Bell className="mr-2 h-4 w-4" />
                    Configure Alerts
                </ZoruButton>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Sentiment Score</ZoruCardTitle>
                        <ZoruCardDescription>AI Analysis of last 100 mentions</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-4xl text-zoru-success">92%</div>
                        <p className="text-sm text-zoru-ink-muted mt-1">Positive Sentiment</p>
                    </ZoruCardContent>
                </ZoruCard>
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>New Mentions</ZoruCardTitle>
                        <ZoruCardDescription>Last 7 Days</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-4xl text-zoru-ink">14</div>
                        <p className="text-sm text-zoru-ink-muted mt-1">+3 from previous week</p>
                    </ZoruCardContent>
                </ZoruCard>
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Share of Voice</ZoruCardTitle>
                        <ZoruCardDescription>vs Competitors</ZoruCardDescription>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <div className="text-4xl text-zoru-ink">18%</div>
                        <p className="text-sm text-zoru-ink-muted mt-1">Rank 3rd in niche</p>
                    </ZoruCardContent>
                </ZoruCard>
            </div>

            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Recent Mentions</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="space-y-4">
                        {[
                            { title: 'Top 10 SEO Tools for 2026', source: 'TechCrunch', sentiment: 'positive' },
                            { title: 'Review: Is Project Titan worth it?', source: 'SEOMaster', sentiment: 'neutral' },
                            { title: 'Why I switched from Ahrefs', source: 'IndieHackers', sentiment: 'positive' },
                        ].map((m, i) => (
                            <div key={i} className="flex items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line p-4">
                                <div>
                                    <h4 className="text-zoru-ink">{m.title}</h4>
                                    <p className="text-sm text-zoru-ink-muted">{m.source}</p>
                                </div>
                                <span
                                    className={`px-2 py-1 rounded text-xs uppercase ${
                                        m.sentiment === 'positive'
                                            ? 'bg-zoru-success/10 text-zoru-success'
                                            : m.sentiment === 'negative'
                                              ? 'bg-zoru-danger/10 text-zoru-danger-ink'
                                              : 'bg-zoru-surface-2 text-zoru-ink-muted'
                                    }`}
                                >
                                    {m.sentiment}
                                </span>
                            </div>
                        ))}
                    </div>
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
