'use client';

import { useEffect, useState, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { addKeyword, getKeywords } from '@/app/actions/seo.actions';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { SeoKeyword } from '@/lib/seo/definitions';

export default function RankingsPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);
    const [keywords, setKeywords] = useState<SeoKeyword[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKeyword, setNewKeyword] = useState('');
    const [adding, setAdding] = useState(false);

    const loadKeywords = async () => {
        setLoading(true);
        const data = await getKeywords(projectId);
        setKeywords(data);
        setLoading(false);
    };

    useEffect(() => {
        loadKeywords();
    }, [projectId]);

    const handleAddKeyword = async () => {
        if (!newKeyword.trim()) return;
        setAdding(true);

        const result = await addKeyword(projectId, newKeyword);
        if (result.success) {
            toast({ title: "Keyword Added", description: "Fetching initial ranking data..." });
            setNewKeyword('');
            loadKeywords();
        } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
        setAdding(false);
    };

    if (loading && keywords.length === 0) return <Skeleton className="h-[400px] w-full" />;

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-primary" />
                        Rank Tracking
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Monitor your keyword positions on Google.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Input
                        placeholder="Add keyword..."
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        className="w-[200px]"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                    />
                    <Button onClick={handleAddKeyword} disabled={adding}>
                        <Plus className="h-4 w-4 mr-2" /> Add
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Keyword Positions</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Keyword</TableHead>
                                <TableHead>Current Rank</TableHead>
                                <TableHead>Volume</TableHead>
                                <TableHead>History</TableHead>
                                <TableHead className="text-right">Last Updated</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {keywords.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No keywords tracked yet. Add one above.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                keywords.map((k: any) => (
                                    <TableRow key={k._id}>
                                        <TableCell className="font-medium">{k.keyword}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={k.currentRank <= 3 ? 'default' : k.currentRank <= 10 ? 'secondary' : 'outline'}>
                                                    {k.currentRank > 0 ? `#${k.currentRank}` : '>100'}
                                                </Badge>
                                                {/* Mock change indicator */}
                                                {k.currentRank > 0 && k.currentRank < 10 && <TrendingUp className="h-3 w-3 text-green-500" />}
                                            </div>
                                        </TableCell>
                                        <TableCell>{k.currentVolume?.toLocaleString() || '-'}</TableCell>
                                        <TableCell>
                                            <div className="flex items-end gap-1 h-8 w-24">
                                                {/* Tiny bar chart viz */}
                                                {[40, 60, 30, 80, 50, k.currentRank || 10].map((h, i) => (
                                                    <div key={i} className="w-2 bg-muted-foreground/20 rounded-sm" style={{ height: `${Math.min(h, 100)}%` }} />
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground text-sm">
                                            {new Date(k.lastUpdated).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
