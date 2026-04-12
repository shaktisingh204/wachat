'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { getTrackedCompetitors, addCompetitor, removeCompetitor, syncCompetitorData } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Target, Plus, Trash2, RefreshCw, ExternalLink, Users, Heart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import Image from 'next/image';

function CompetitorsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <Skeleton className="h-20 w-full" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
            </div>
        </div>
    );
}

export default function CompetitorsPage() {
    const [competitors, setCompetitors] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [isAdding, startAddTransition] = useTransition();
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [projectId, setProjectId] = useState<string | null>(null);
    const [newPageId, setNewPageId] = useState('');
    const { toast } = useToast();

    const fetchCompetitors = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const { competitors: fetched, error: fetchError } = await getTrackedCompetitors(projectId);
            if (fetchError) {
                setError(fetchError);
            } else if (fetched) {
                setCompetitors(fetched);
            }
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchCompetitors();
    }, [projectId, fetchCompetitors]);

    const handleAdd = () => {
        if (!projectId || !newPageId.trim()) return;
        startAddTransition(async () => {
            const result = await addCompetitor(projectId, newPageId.trim());
            if (result.error) {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: 'Competitor added successfully.' });
                setNewPageId('');
                fetchCompetitors();
            }
        });
    };

    const handleSync = async (competitorId: string) => {
        setSyncingId(competitorId);
        const result = await syncCompetitorData(competitorId);
        setSyncingId(null);
        if (result.error) {
            toast({ title: 'Sync Failed', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Synced', description: 'Competitor data refreshed.' });
            fetchCompetitors();
        }
    };

    const handleRemove = async (competitorId: string) => {
        const result = await removeCompetitor(competitorId);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Removed', description: 'Competitor removed.' });
            setCompetitors((prev) => prev.filter((c) => c._id !== competitorId && c.id !== competitorId));
        }
    };

    if (isLoading && competitors.length === 0) {
        return <CompetitorsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Target className="h-8 w-8" />
                    Competitor Tracker
                </h1>
                <p className="text-muted-foreground mt-2">
                    Track and compare competitor Facebook Pages.
                </p>
            </div>

            {!projectId ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>Please select a project from the main dashboard.</AlertDescription>
                </Alert>
            ) : error ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : (
                <>
                    {/* Add Competitor */}
                    <Card className="card-gradient card-gradient-blue">
                        <CardHeader><CardTitle className="text-base">Add Competitor</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex gap-3 items-end">
                                <div className="flex-1 space-y-2">
                                    <Input
                                        value={newPageId}
                                        onChange={(e) => setNewPageId(e.target.value)}
                                        placeholder="Facebook Page ID"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                    />
                                </div>
                                <Button onClick={handleAdd} disabled={isAdding || !newPageId.trim()}>
                                    <Plus className="h-4 w-4 mr-2" /> Track
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Competitor Grid */}
                    {competitors.length > 0 ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {competitors.map((comp: any) => (
                                <Card key={comp._id || comp.id} className="card-gradient card-gradient-blue flex flex-col">
                                    <CardContent className="p-5 space-y-3 flex-1">
                                        <div className="flex items-center gap-3">
                                            {comp.picture ? (
                                                <Image
                                                    src={comp.picture}
                                                    alt={comp.name || 'Competitor'}
                                                    width={48}
                                                    height={48}
                                                    className="rounded-full object-cover"
                                                    data-ai-hint="competitor avatar"
                                                />
                                            ) : (
                                                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                                    <Users className="h-5 w-5" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold truncate">{comp.name || 'Unknown Page'}</p>
                                                {comp.category && (
                                                    <Badge variant="secondary" className="text-xs mt-1">{comp.category}</Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-muted-foreground text-xs">Fans</p>
                                                <p className="font-semibold flex items-center gap-1">
                                                    <Heart className="h-3 w-3" /> {(comp.fan_count || 0).toLocaleString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground text-xs">Followers</p>
                                                <p className="font-semibold flex items-center gap-1">
                                                    <Users className="h-3 w-3" /> {(comp.followers_count || 0).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        {comp.about && (
                                            <p className="text-xs text-muted-foreground line-clamp-2">{comp.about}</p>
                                        )}

                                        {comp.link && (
                                            <a href={comp.link} target="_blank" rel="noopener noreferrer"
                                                className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                                                <ExternalLink className="h-3 w-3" /> View on Facebook
                                            </a>
                                        )}

                                        {comp.lastSynced && (
                                            <p className="text-[11px] text-muted-foreground">
                                                Synced {formatDistanceToNow(new Date(comp.lastSynced), { addSuffix: true })}
                                            </p>
                                        )}
                                    </CardContent>

                                    <div className="border-t p-3 flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => handleSync(comp._id || comp.id)}
                                            disabled={syncingId === (comp._id || comp.id)}
                                        >
                                            <RefreshCw className={`h-3 w-3 mr-1 ${syncingId === (comp._id || comp.id) ? 'animate-spin' : ''}`} /> Sync
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleRemove(comp._id || comp.id)}
                                        >
                                            <Trash2 className="h-3 w-3 mr-1" /> Remove
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                            <CardContent>
                                <Target className="h-10 w-10 mx-auto mb-3 opacity-50" />
                                <p className="text-lg font-semibold">No Competitors Tracked</p>
                                <p className="mt-1">Enter a Facebook Page ID above to start tracking a competitor&apos;s performance.</p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
