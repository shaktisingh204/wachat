'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { deleteKeyword } from '@/app/actions/seo-rank.actions';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export function RankingsTable({ keywords, onRefresh }: { keywords: any[]; onRefresh: () => void }) {

    const handleDelete = async (id: string) => {
        if (!confirm("Stop tracking this keyword?")) return;
        await deleteKeyword(id);
        toast({ title: "Keyword Deleted" });
        onRefresh();
    };

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Keyword</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Current Rank</TableHead>
                        <TableHead>Change (24h)</TableHead>
                        <TableHead>Volume</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {keywords.map((kw) => (
                        <TableRow key={kw._id}>
                            <TableCell className="font-medium">
                                <div className="flex flex-col">
                                    <span>{kw.keyword}</span>
                                    {kw.history?.[kw.history.length - 1]?.url && (
                                        <a href={kw.history?.[kw.history.length - 1]?.url} target="_blank" className="text-xs text-muted-foreground hover:underline truncate max-w-[200px]">
                                            {kw.history?.[kw.history.length - 1]?.url}
                                        </a>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <LocationBadge code={kw.location} />
                            </TableCell>
                            <TableCell>
                                <RankDisplay rank={kw.currentRank} />
                            </TableCell>
                            <TableCell>
                                <RankChange history={kw.history} />
                            </TableCell>
                            <TableCell>{kw.currentVolume?.toLocaleString() || '-'}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={getDifficultyColor(kw.currentDifficulty)}>
                                    {kw.currentDifficulty || 0}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(kw._id)}>
                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    {keywords.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                No keywords tracked yet. Add some to get started.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

function LocationBadge({ code }: { code: string }) {
    const map: Record<string, string> = {
        '2840': '🇺🇸 US',
        '2826': '🇬🇧 UK',
        '2356': '🇮🇳 IN',
        '2036': '🇦🇺 AU'
    };
    return <Badge variant="secondary" className="font-normal">{map[code] || code}</Badge>;
}

function RankDisplay({ rank }: { rank?: number }) {
    if (!rank || rank === 0) return <span className="text-muted-foreground">-</span>;
    if (rank <= 3) return <span className="font-bold text-green-600 text-lg">#{rank}</span>;
    if (rank <= 10) return <span className="font-medium text-green-600">#{rank}</span>;
    return <span>#{rank}</span>;
}

function RankChange({ history }: { history: any[] }) {
    if (!history || history.length < 2) return <Minus className="h-4 w-4 text-muted-foreground" />;

    // Sort by date just in case
    // Assuming history is appended, so last is newest.
    // Compare last vs 2nd last
    const current = history[history.length - 1].rank;
    const prev = history[history.length - 2].rank;

    if (current === 0 || prev === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;

    const change = prev - current; // Rank decrease is GOOD (moved up)

    if (change === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (change > 0) return <div className="flex items-center text-green-600"><TrendingUp className="h-4 w-4 mr-1" /> {change}</div>;
    return <div className="flex items-center text-red-500"><TrendingDown className="h-4 w-4 mr-1" /> {Math.abs(change)}</div>;
}

function getDifficultyColor(diff?: number) {
    if (!diff) return "";
    if (diff > 80) return "bg-red-100 text-red-800";
    if (diff > 60) return "bg-orange-100 text-orange-800";
    if (diff > 40) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
}
