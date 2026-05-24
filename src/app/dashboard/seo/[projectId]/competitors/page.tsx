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
    Separator 
} from '@/components/zoruui';
import { use, useMemo } from 'react';
import { Swords, Plus, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { analyzeGaps, summarizeByCompetitor } from '@/lib/seo-suite/competitors';
import { RankPosition } from '@/lib/seo-suite/types';

const MOCK_OUR_POSITIONS: RankPosition[] = [
    { keyword: 'seo software', engine: 'google', location: 'us', device: 'desktop', position: 12, checkedAt: new Date().toISOString() },
    { keyword: 'rank tracker tool', engine: 'google', location: 'us', device: 'desktop', position: 5, checkedAt: new Date().toISOString() },
    { keyword: 'site audit checklist', engine: 'google', location: 'us', device: 'desktop', position: null, checkedAt: new Date().toISOString() },
    { keyword: 'backlink checker', engine: 'google', location: 'us', device: 'desktop', position: 22, checkedAt: new Date().toISOString() },
    { keyword: 'keyword research tool', engine: 'google', location: 'us', device: 'desktop', position: 8, checkedAt: new Date().toISOString() },
];

const MOCK_COMPETITORS = [
    {
        competitor: 'competitor-a.com',
        positions: [
            { keyword: 'seo software', engine: 'google' as const, location: 'us', device: 'desktop' as const, position: 2, checkedAt: new Date().toISOString() },
            { keyword: 'rank tracker tool', engine: 'google' as const, location: 'us', device: 'desktop' as const, position: 1, checkedAt: new Date().toISOString() },
            { keyword: 'site audit checklist', engine: 'google' as const, location: 'us', device: 'desktop' as const, position: 3, checkedAt: new Date().toISOString() },
            { keyword: 'backlink checker', engine: 'google' as const, location: 'us', device: 'desktop' as const, position: 5, checkedAt: new Date().toISOString() },
            { keyword: 'keyword research tool', engine: 'google' as const, location: 'us', device: 'desktop' as const, position: 4, checkedAt: new Date().toISOString() },
        ]
    },
    {
        competitor: 'competitor-b.com',
        positions: [
            { keyword: 'seo software', engine: 'google' as const, location: 'us', device: 'desktop' as const, position: 8, checkedAt: new Date().toISOString() },
            { keyword: 'rank tracker tool', engine: 'google' as const, location: 'us', device: 'desktop' as const, position: 15, checkedAt: new Date().toISOString() },
            { keyword: 'site audit checklist', engine: 'google' as const, location: 'us', device: 'desktop' as const, position: 2, checkedAt: new Date().toISOString() },
            { keyword: 'backlink checker', engine: 'google' as const, location: 'us', device: 'desktop' as const, position: 10, checkedAt: new Date().toISOString() },
            { keyword: 'local seo guide', engine: 'google' as const, location: 'us', device: 'desktop' as const, position: 1, checkedAt: new Date().toISOString() },
        ]
    }
];

const MOCK_VOLUMES: Record<string, number> = {
    'seo software': 12000,
    'rank tracker tool': 3500,
    'site audit checklist': 1800,
    'backlink checker': 8500,
    'keyword research tool': 15000,
    'local seo guide': 2200,
};

const MOCK_BACKLINK_PROFILES = [
    {
        domain: 'our-domain.com',
        totalBacklinks: 1250,
        referringDomains: 340,
        avgDomainAuthority: 42,
        topAnchors: ['our domain', 'seo tools', 'best rank tracker']
    },
    {
        domain: 'competitor-a.com',
        totalBacklinks: 8400,
        referringDomains: 1250,
        avgDomainAuthority: 58,
        topAnchors: ['competitor a', 'seo software', 'rank tracking']
    },
    {
        domain: 'competitor-b.com',
        totalBacklinks: 3200,
        referringDomains: 800,
        avgDomainAuthority: 49,
        topAnchors: ['competitor b', 'site audit', 'seo guide']
    }
];

export default function CompetitorsPage({ params }: { params: Promise<{ projectId: string }> }) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { projectId } = use(params);

    const gaps = useMemo(() => {
        return analyzeGaps({
            ourPositions: MOCK_OUR_POSITIONS,
            competitors: MOCK_COMPETITORS,
            volumeMap: MOCK_VOLUMES,
        });
    }, []);

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
                <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Competitor
                </Button>
            </div>

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
                            {gaps.map((gap, i) => (
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
                            ))}
                        </TableBody>
                    </Table>
                </ZoruCardContent>
            </Card>

            <div className="flex items-center gap-3 mt-4">
                <LinkIcon className="h-6 w-6 text-zoru-ink" />
                <h2 className="text-2xl text-zoru-ink font-semibold tracking-tight">Backlink Profiles Comparison</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {MOCK_BACKLINK_PROFILES.map(profile => (
                    <Card key={profile.domain} className={profile.domain === 'our-domain.com' ? 'border-zoru-primary bg-zoru-primary/5' : ''}>
                        <ZoruCardHeader>
                            <ZoruCardTitle className="flex justify-between items-center text-lg">
                                <span>{profile.domain}</span>
                                {profile.domain === 'our-domain.com' && <Badge variant="default">You</Badge>}
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
                                    <span className="text-zoru-ink-muted text-sm">Avg. Domain Authority</span>
                                    <span className="font-semibold">{profile.avgDomainAuthority}</span>
                                </div>
                                <Separator className="my-2" />
                                <div>
                                    <span className="text-xs font-medium text-zoru-ink-muted uppercase tracking-wider mb-3 block">Top Anchors</span>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.topAnchors.map(anchor => (
                                            <Badge key={anchor} variant="secondary" className="text-xs font-normal">{anchor}</Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </ZoruCardContent>
                    </Card>
                ))}
            </div>

        </div>
    );
}
