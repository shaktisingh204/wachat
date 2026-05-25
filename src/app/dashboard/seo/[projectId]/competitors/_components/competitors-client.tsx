'use client';

import { 
    Button, 
    Card, 
    ZoruCardContent, 
    ZoruCardHeader, 
    ZoruCardTitle, 
    Table, 
    TableHeader, 
    TableRow, 
    TableHead, 
    TableBody, 
    TableCell, 
    Badge, 
    StatCard, 
    Separator,
    Skeleton,
    useZoruToast
} from '@/components/zoruui';
import { use, useEffect, useMemo, useState } from 'react';
import { Swords, Plus, AlertCircle, Link as LinkIcon, Activity } from 'lucide-react';
import { analyzeGaps, summarizeByCompetitor } from '@/lib/seo-suite/competitors';
import { RankPosition } from '@/lib/seo-suite/types';
import { getCompetitorAnalysisData } from '@/app/actions/seo.actions';
import Link from 'next/link';

export function CompetitorsClient({ projectId, initialData }: { projectId: string, initialData: any }) {
    const { toast } = useZoruToast();
    const [data] = useState<{
        ourPositions: RankPosition[];
        competitorsRanks: any[];
        volumeMap: Record<string, number>;
        backlinkProfiles: any[];
    }>(initialData || { ourPositions: [], competitorsRanks: [], volumeMap: {}, backlinkProfiles: [] });

    const gaps = useMemo(() => {
        if (!data) return [];
        return analyzeGaps({
            ourPositions: data.ourPositions,
            competitors: data.competitorsRanks,
            volumeMap: data.volumeMap,
        });
    }, [data]);

    const competitorSummaries = useMemo(() => {
        return summarizeByCompetitor(gaps);
    }, [gaps]);



    return (
        <div className="flex flex-col gap-6 pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl text-zoru-ink flex items-center gap-3">
                        <Swords className="h-8 w-8 text-zoru-ink" />
                        Competitor Gap
                    </h1>
                    <p className="text-zoru-ink-muted mt-1">Analyze where competitors are beating you.</p>
                </div>
                <Link href={`/dashboard/seo/${projectId}`}>
                    <Button variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Manage Competitors
                    </Button>
                </Link>
            </div>

            {competitorSummaries.length === 0 ? (
                <div className="text-center py-12 border border-zoru-line border-dashed rounded-[var(--zoru-radius)] bg-zoru-surface">
                    <p className="text-zoru-ink-muted text-sm">No competitors or keywords found. Add competitors and keywords in Project Settings.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {competitorSummaries.map(summary => (
                            <StatCard
                                key={summary.competitor}
                                label={summary.competitor}
                                value={`${summary.totalGaps} Gaps`}
                                period={`${summary.easyWins} easy wins available`}
                                icon={<AlertCircle />}
                            />
                        ))}
                    </div>

                    <Card>
                        <ZoruCardHeader>
                            <ZoruCardTitle>Keyword Gap Opportunities</ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Keyword</TableHead>
                                        <TableHead>Volume</TableHead>
                                        <TableHead>Competitor</TableHead>
                                        <TableHead>Their Position</TableHead>
                                        <TableHead>Our Position</TableHead>
                                        <TableHead>Opportunity</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {gaps.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-zoru-ink-muted">
                                                No gaps found. You might be outranking them!
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        gaps.map((gap, i) => (
                                            <TableRow key={`${gap.competitor}-${gap.keyword}-${i}`}>
                                                <TableCell className="font-medium">{gap.keyword}</TableCell>
                                                <TableCell>{gap.volume.toLocaleString()}</TableCell>
                                                <TableCell>{gap.competitor}</TableCell>
                                                <TableCell>#{gap.theirPosition}</TableCell>
                                                <TableCell>{gap.ourPosition ? `#${gap.ourPosition}` : <span className="text-zoru-ink-muted">Not Ranked</span>}</TableCell>
                                                <TableCell>
                                                    <Badge variant={gap.opportunity === 'easy' ? 'success' : gap.opportunity === 'medium' ? 'warning' : 'destructive'}>
                                                        {gap.opportunity.charAt(0).toUpperCase() + gap.opportunity.slice(1)}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </ZoruCardContent>
                    </Card>
                </>
            )}

            {data.backlinkProfiles.length > 0 && (
                <>
                    <div className="flex items-center gap-3 mt-4">
                        <LinkIcon className="h-6 w-6 text-zoru-ink" />
                        <h2 className="text-2xl text-zoru-ink font-semibold tracking-tight">Backlink & Velocity Comparison</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {data.backlinkProfiles.map((profile, idx) => (
                            <Card key={`${profile.domain}-${idx}`} className={idx === 0 ? 'border-zoru-primary bg-zoru-primary/5' : ''}>
                                <ZoruCardHeader>
                                    <ZoruCardTitle className="flex justify-between items-center text-lg">
                                        <span className="truncate max-w-[200px]" title={profile.domain}>{profile.domain}</span>
                                        {idx === 0 && <Badge variant="default">You</Badge>}
                                    </ZoruCardTitle>
                                </ZoruCardHeader>
                                <ZoruCardContent>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-zoru-ink-muted text-sm">Total Backlinks</span>
                                            <span className="font-semibold">{profile.totalBacklinks.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-zoru-ink-muted text-sm">Referring Domains</span>
                                            <span className="font-semibold">{profile.referringDomains.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-zoru-ink-muted text-sm">Avg. DA</span>
                                            <span className="font-semibold">{profile.avgDomainAuthority}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-zoru-ink-muted text-sm flex items-center gap-1">
                                                <Activity className="h-3 w-3" /> Content Velocity
                                            </span>
                                            <span className="font-semibold">{profile.contentVelocity} pages/mo</span>
                                        </div>
                                        <Separator className="my-2" />
                                        <div>
                                            <span className="text-xs font-medium text-zoru-ink-muted uppercase tracking-wider mb-3 block">Top Anchors</span>
                                            <div className="flex flex-wrap gap-2">
                                                {profile.topAnchors.map((anchor: string) => (
                                                    <Badge key={anchor} variant="secondary" className="text-xs font-normal">{anchor}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </ZoruCardContent>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
