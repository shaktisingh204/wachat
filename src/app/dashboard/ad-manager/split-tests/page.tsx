'use client';

import * as React from 'react';
import { FlaskConical, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const VARIABLES = [
    { id: 'creative', label: 'Creative', desc: 'Compare different ad creatives head-to-head.' },
    { id: 'audience', label: 'Audience', desc: 'Test two different targeting definitions.' },
    { id: 'placement', label: 'Placement', desc: 'Compare Facebook vs Instagram vs Reels.' },
    { id: 'optimization', label: 'Optimization', desc: 'Test different delivery optimization goals.' },
    { id: 'bid_strategy', label: 'Bid strategy', desc: 'Compare Lowest cost vs Cost cap vs Bid cap.' },
];

export default function SplitTestsPage() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FlaskConical className="h-6 w-6" /> A/B split tests
                        <Badge className="bg-[#1877F2] text-white">Advanced</Badge>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Run scientific experiments across creatives, audiences, placements and bid strategies.
                        Winner is auto-selected when statistical significance is reached.
                    </p>
                </div>
                <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                    <Plus className="h-4 w-4 mr-1" /> Create split test
                </Button>
            </div>

            <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Beyond Meta Ads Manager</AlertTitle>
                <AlertDescription>
                    SabNode supports multi-variable tests (2–5 variants simultaneously) with
                    automatic budget reallocation to the winning variant once 95% confidence is reached.
                </AlertDescription>
            </Alert>

            <div>
                <h2 className="text-sm font-semibold mb-2">Pick a variable to test</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {VARIABLES.map((v) => (
                        <Card key={v.id} className="cursor-pointer hover:border-[#1877F2]/50 transition-colors">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">{v.label}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">{v.desc}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
