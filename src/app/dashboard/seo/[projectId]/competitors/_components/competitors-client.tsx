'use client';

import { Button, Card, CardBody, CardHeader, CardTitle, Table, THead, Tr, Th, TBody, Td, Badge, StatCard, Separator, Skeleton, useToast } from '@/components/sabcrm/20ui/compat';
import { use, useEffect, useMemo, useState } from 'react';
import { Swords, Plus, AlertCircle, Link as LinkIcon, Activity } from 'lucide-react';
import { analyzeGaps, summarizeByCompetitor } from '@/lib/seo-suite/competitors';
import { RankPosition } from '@/lib/seo-suite/types';
import { getCompetitorAnalysisData } from '@/app/actions/seo.actions';
import Link from 'next/link';

export function CompetitorsClient({ projectId, initialData }: { projectId: string, initialData: any }) {
    const { toast } = useToast();
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
                    <h1 className="text-3xl text-[var(--st-text)] flex items-center gap-3">
                        <Swords className="h-8 w-8 text-[var(--st-text)]" />
                        Competitor Gap
                    </h1>
                    <p className="text-[var(--st-text-secondary)] mt-1">Analyze where competitors are beating you.</p>
                </div>
                <Link href={`/dashboard/seo/${projectId}`}>
                    <Button variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Manage Competitors
                    </Button>
                </Link>
            </div>

            {competitorSummaries.length === 0 ? (
                <div className="text-center py-12 border border-[var(--st-border)] border-dashed rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                    <p className="text-[var(--st-text-secondary)] text-sm">No competitors or keywords found. Add competitors and keywords in Project Settings.</p>
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
                        <CardHeader>
                            <CardTitle>Keyword Gap Opportunities</CardTitle>
                        </CardHeader>
                        <CardBody>
                            <Table>
                                <THead>
                                    <Tr>
                                        <Th>Keyword</Th>
                                        <Th>Volume</Th>
                                        <Th>Competitor</Th>
                                        <Th>Their Position</Th>
                                        <Th>Our Position</Th>
                                        <Th>Opportunity</Th>
                                    </Tr>
                                </THead>
                                <TBody>
                                    {gaps.length === 0 ? (
                                        <Tr>
                                            <Td colSpan={6} className="text-center py-8 text-[var(--st-text-secondary)]">
                                                No gaps found. You might be outranking them!
                                            </Td>
                                        </Tr>
                                    ) : (
                                        gaps.map((gap, i) => (
                                            <Tr key={`${gap.competitor}-${gap.keyword}-${i}`}>
                                                <Td className="font-medium">{gap.keyword}</Td>
                                                <Td>{gap.volume.toLocaleString()}</Td>
                                                <Td>{gap.competitor}</Td>
                                                <Td>#{gap.theirPosition}</Td>
                                                <Td>{gap.ourPosition ? `#${gap.ourPosition}` : <span className="text-[var(--st-text-secondary)]">Not Ranked</span>}</Td>
                                                <Td>
                                                    <Badge variant={gap.opportunity === 'easy' ? 'success' : gap.opportunity === 'medium' ? 'warning' : 'destructive'}>
                                                        {gap.opportunity.charAt(0).toUpperCase() + gap.opportunity.slice(1)}
                                                    </Badge>
                                                </Td>
                                            </Tr>
                                        ))
                                    )}
                                </TBody>
                            </Table>
                        </CardBody>
                    </Card>
                </>
            )}

            {data.backlinkProfiles.length > 0 && (
                <>
                    <div className="flex items-center gap-3 mt-4">
                        <LinkIcon className="h-6 w-6 text-[var(--st-text)]" />
                        <h2 className="text-2xl text-[var(--st-text)] font-semibold tracking-tight">Backlink & Velocity Comparison</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {data.backlinkProfiles.map((profile, idx) => (
                            <Card key={`${profile.domain}-${idx}`} className={idx === 0 ? 'border-[var(--st-text)] bg-[var(--st-text)]/5' : ''}>
                                <CardHeader>
                                    <CardTitle className="flex justify-between items-center text-lg">
                                        <span className="truncate max-w-[200px]" title={profile.domain}>{profile.domain}</span>
                                        {idx === 0 && <Badge variant="default">You</Badge>}
                                    </CardTitle>
                                </CardHeader>
                                <CardBody>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[var(--st-text-secondary)] text-sm">Total Backlinks</span>
                                            <span className="font-semibold">{profile.totalBacklinks.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[var(--st-text-secondary)] text-sm">Referring Domains</span>
                                            <span className="font-semibold">{profile.referringDomains.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[var(--st-text-secondary)] text-sm">Avg. DA</span>
                                            <span className="font-semibold">{profile.avgDomainAuthority}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[var(--st-text-secondary)] text-sm flex items-center gap-1">
                                                <Activity className="h-3 w-3" /> Content Velocity
                                            </span>
                                            <span className="font-semibold">{profile.contentVelocity} pages/mo</span>
                                        </div>
                                        <Separator className="my-2" />
                                        <div>
                                            <span className="text-xs font-medium text-[var(--st-text-secondary)] uppercase tracking-wider mb-3 block">Top Anchors</span>
                                            <div className="flex flex-wrap gap-2">
                                                {profile.topAnchors.map((anchor: string) => (
                                                    <Badge key={anchor} variant="secondary" className="text-xs font-normal">{anchor}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
