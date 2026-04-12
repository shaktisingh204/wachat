'use client';

import { use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { History, Eye, ArrowRight } from 'lucide-react';

export default function TimeTravelPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <History className="h-8 w-8 text-primary" />
                        SERP Time Travel
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Compare historical snapshots of competitor pages.
                    </p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Tracked Competitors</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="p-3 border rounded bg-muted/50 cursor-pointer hover:bg-muted">
                            <h4 className="font-semibold">competitor-a.com/blog/seo-tips</h4>
                            <p className="text-xs text-muted-foreground">Last changed: 2 days ago</p>
                        </div>
                        <div className="p-3 border rounded hover:bg-muted cursor-pointer">
                            <h4 className="font-semibold">competitor-b.com/pricing</h4>
                            <p className="text-xs text-muted-foreground">Last changed: 5 days ago</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-2">
                    <CardHeader>
                        <CardTitle>Visual Diff (Feb 1st vs Feb 5th)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[400px] overflow-auto bg-slate-50 p-4 border rounded font-mono text-sm">

                        <div className="space-y-1">
                            <div className="text-muted-foreground">...</div>
                            <div className="">&lt;h1&gt;The Ultimate Guide to SEO&lt;/h1&gt;</div>
                            <div className="bg-red-100 text-red-800 line-through">- &lt;p&gt; SEO is hard in 2025. &lt;/p&gt;</div>
                            <div className="bg-green-100 text-green-800">+ &lt;p&gt; SEO is easy with Project Titan. &lt;/p&gt;</div>
                            <div className="">&lt;h2&gt;Chapter 1: Basics&lt;/h2&gt;</div>
                            <div className="text-muted-foreground">...</div>
                        </div>

                        <div className="mt-8 flex justify-center">
                            <Button variant="outline">
                                View Full HTML Side-by-Side <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
