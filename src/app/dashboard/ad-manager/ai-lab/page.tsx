'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sparkles, Wand2, Clapperboard, Type, BarChart3, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const TOOLS = [
    { id: 'copy', icon: Type, label: 'Ad copy generator', desc: 'Generate primary text, headlines, and descriptions from a brief.' },
    { id: 'video', icon: Clapperboard, label: 'Promo video generator', desc: 'Turn product images into a 15-second promo video.', href: '/dashboard/whatsapp-ads' },
    { id: 'sentiment', icon: BarChart3, label: 'Sentiment analyzer', desc: 'Score your ad copy for emotion, clarity, and CTA strength.' },
    { id: 'variants', icon: Wand2, label: 'Creative variants', desc: 'Generate 10 creative variations from a single seed ad.' },
    { id: 'audience', icon: Zap, label: 'Audience discovery', desc: 'Suggest targeting interests based on your product description.' },
];

export default function AiLabPage() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-[#1877F2]" /> AI creative lab
                        <Badge className="bg-gradient-to-r from-[#1877F2] to-purple-600 text-white border-0">
                            Only on SabNode
                        </Badge>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Machine-learning workflows Meta Ads Manager doesn't offer.
                    </p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {TOOLS.map((t) => {
                    const Icon = t.icon;
                    const card = (
                        <Card className="cursor-pointer hover:border-[#1877F2]/50 transition-colors h-full">
                            <CardHeader className="pb-2">
                                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#1877F2]/10 to-purple-600/10 flex items-center justify-center text-[#1877F2]">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <CardTitle className="text-base mt-2">{t.label}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">{t.desc}</p>
                            </CardContent>
                        </Card>
                    );
                    return t.href ? (
                        <Link key={t.id} href={t.href}>{card}</Link>
                    ) : (
                        <div key={t.id}>{card}</div>
                    );
                })}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Wand2 className="h-4 w-4" /> Quick ad copy generator
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-2">
                        <Label>Product / offer brief</Label>
                        <Textarea
                            placeholder="e.g. 30% off a premium yoga subscription for new signups"
                            className="min-h-24"
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button className="bg-[#1877F2] hover:bg-[#1877F2]/90 text-white">
                            <Sparkles className="h-4 w-4 mr-1" /> Generate 10 variants
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
