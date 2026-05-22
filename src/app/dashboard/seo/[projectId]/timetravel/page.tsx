'use client';

import { Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import { use } from 'react';

import { History, ArrowRight } from 'lucide-react';

export default function TimeTravelPage({ params }: { params: Promise<{ projectId: string }> }) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projectId } = use(params);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                        <History className="h-8 w-8 text-zoru-ink" />
                        SERP Time Travel
                    </h1>
                    <p className="text-zoru-ink-muted mt-1">Compare historical snapshots of competitor pages.</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <ZoruCard className="col-span-1">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Tracked Competitors</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="space-y-2">
                        <div className="cursor-pointer rounded border border-zoru-line bg-zoru-surface-2/50 p-3 hover:bg-zoru-surface-2">
                            <h4 className="text-zoru-ink">competitor-a.com/blog/seo-tips</h4>
                            <p className="text-xs text-zoru-ink-muted">Last changed: 2 days ago</p>
                        </div>
                        <div className="cursor-pointer rounded border border-zoru-line p-3 hover:bg-zoru-surface-2">
                            <h4 className="text-zoru-ink">competitor-b.com/pricing</h4>
                            <p className="text-xs text-zoru-ink-muted">Last changed: 5 days ago</p>
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                <ZoruCard className="col-span-2">
                    <ZoruCardHeader>
                        <ZoruCardTitle>Visual Diff (Feb 1st vs Feb 5th)</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="h-[400px] overflow-auto rounded border border-zoru-line bg-zoru-surface-2/50 p-4 font-mono text-sm">
                        <div className="space-y-1">
                            <div className="text-zoru-ink-muted">...</div>
                            <div className="text-zoru-ink">&lt;h1&gt;The Ultimate Guide to SEO&lt;/h1&gt;</div>
                            <div className="bg-zoru-danger/10 text-zoru-danger-ink line-through">
                                - &lt;p&gt; SEO is hard in 2025. &lt;/p&gt;
                            </div>
                            <div className="bg-zoru-success/10 text-zoru-success">
                                + &lt;p&gt; SEO is easy with Project Titan. &lt;/p&gt;
                            </div>
                            <div className="text-zoru-ink">&lt;h2&gt;Chapter 1: Basics&lt;/h2&gt;</div>
                            <div className="text-zoru-ink-muted">...</div>
                        </div>

                        <div className="mt-8 flex justify-center">
                            <ZoruButton variant="outline">
                                View Full HTML Side-by-Side <ArrowRight className="ml-2 h-4 w-4" />
                            </ZoruButton>
                        </div>
                    </ZoruCardContent>
                </ZoruCard>
            </div>
        </div>
    );
}
