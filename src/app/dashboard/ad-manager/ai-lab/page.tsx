'use client';

import { Badge, Button, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Label, Textarea } from '@/components/sabcrm/20ui/compat';
import {
  Sparkles,
  Wand2,
  Clapperboard,
  Type,
  BarChart3,
  Zap } from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import {
    AmBreadcrumb,
    AmHeader,
} from '@/app/dashboard/ad-manager/_components/am-page-shell';
import { useToast } from '@/hooks/use-toast';
import { generateAdVariants } from './actions';

const TOOLS = [
    { id: 'copy', icon: Type, label: 'Ad copy generator', desc: 'Generate primary text, headlines, and descriptions from a brief.' },
    { id: 'video', icon: Clapperboard, label: 'Promo video generator', desc: 'Turn product images into a 15-second promo video.', href: '/wachat/whatsapp-ads' },
    { id: 'sentiment', icon: BarChart3, label: 'Sentiment analyzer', desc: 'Score your ad copy for emotion, clarity, and CTA strength.' },
    { id: 'variants', icon: Wand2, label: 'Creative variants', desc: 'Generate 10 creative variations from a single seed ad.' },
    { id: 'audience', icon: Zap, label: 'Audience discovery', desc: 'Suggest targeting interests based on your product description.' },
];

export default function AiLabPage() {
    const { toast } = useToast();
    const [brief, setBrief] = React.useState('');
    const [results, setResults] = React.useState<string[]>([]);
    const [generating, setGenerating] = React.useState(false);

    return (
        <>
            <AmBreadcrumb page="AI Lab" />

            <AmHeader
                title="AI creative lab"
                description="Machine-learning workflows Meta Ads Manager doesn't offer."
                actions={
                    <Badge className="bg-gradient-to-r from-[var(--st-text)] to-[var(--st-text)] text-white border-0">
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        Only on SabNode
                    </Badge>
                }
            />

            <div className="mt-6 space-y-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {TOOLS.map((t) => {
                        const Icon = t.icon;
                        const card = (
                            <Card className="cursor-pointer hover:border-[var(--st-border)]/50 transition-colors h-full">
                                <ZoruCardHeader className="pb-2">
                                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[var(--st-text)]/10 to-[var(--st-text)]/10 flex items-center justify-center text-[var(--st-text)]">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <ZoruCardTitle className="text-base mt-2">{t.label}</ZoruCardTitle>
                                </ZoruCardHeader>
                                <ZoruCardContent>
                                    <p className="text-xs text-[var(--st-text-secondary)]">{t.desc}</p>
                                </ZoruCardContent>
                            </Card>
                        );
                        return t.href ? (
                            <Link key={t.id} href={t.href}>{card}</Link>
                        ) : (
                            <div key={t.id} onClick={() => toast({ title: t.label, description: 'This tool is being set up. Use the Quick generator below.' })}>{card}</div>
                        );
                    })}
                </div>

                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle className="text-base flex items-center gap-2">
                            <Wand2 className="h-4 w-4" /> Quick ad copy generator
                        </ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="space-y-3">
                        <div className="space-y-2">
                            <Label>Product / offer brief</Label>
                            <Textarea
                                placeholder="e.g. 30% off a premium yoga subscription for new signups"
                                className="min-h-24"
                                value={brief}
                                onChange={(e) => setBrief(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end">
                            <Button
                                className="bg-[var(--st-text)] hover:bg-[var(--st-text)]/90 text-white"
                                disabled={generating || !brief.trim()}
                                onClick={async () => {
                                    if (!brief.trim()) return;
                                    setGenerating(true);
                                    const res = await generateAdVariants(brief.trim());
                                    if (res.error) {
                                        toast({ title: 'Error', description: res.error, variant: 'destructive' });
                                    } else if (res.variants) {
                                        setResults(res.variants);
                                    }
                                    setGenerating(false);
                                }}
                            >
                                <Sparkles className="h-4 w-4 mr-1" /> Generate 10 variants
                            </Button>
                        </div>
                        {results.length > 0 && (
                            <div className="space-y-2 mt-4">
                                <Label className="text-sm font-medium">Generated Variants</Label>
                                {results.map((r, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-[var(--st-bg-secondary)]">
                                        <span className="text-sm">{r}</span>
                                        <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(r)}>Copy</Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ZoruCardContent>
                </Card>
            </div>
        </>
    );
}
