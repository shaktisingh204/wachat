'use client';

import { useEffect, useState, useTransition, useCallback, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { getAudienceSegments, saveAudienceSegment, deleteAudienceSegment } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Users, LoaderCircle, Plus, Trash2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRef } from 'react';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create Segment
        </Button>
    );
}

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-64 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
        </div>
    );
}

export default function AudiencePage() {
    const [segments, setSegments] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [gender, setGender] = useState('all');
    const [state, formAction] = useActionState(saveAudienceSegment, initialState);
    const formRef = useRef<HTMLFormElement>(null);
    const { toast } = useToast();

    const fetchSegments = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const { segments: fetched, error: fetchError } = await getAudienceSegments(projectId);
            if (fetchError) setError(fetchError);
            else if (fetched) setSegments(fetched);
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => { fetchSegments(); }, [projectId, fetchSegments]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            formRef.current?.reset();
            setGender('all');
            fetchSegments();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, fetchSegments]);

    const handleDelete = (segmentId: string) => {
        startTransition(async () => {
            const result = await deleteAudienceSegment(segmentId);
            if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' });
            else fetchSegments();
        });
    };

    if (isLoading && segments.length === 0) return <PageSkeleton />;

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Users className="h-8 w-8" />
                    Audience Segments
                </h1>
                <p className="text-muted-foreground mt-2">
                    Create audience segments to target broadcasts and campaigns.
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
                    <form action={formAction} ref={formRef}>
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="filterGender" value={gender} />
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader><CardTitle>Create Segment</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Name</Label>
                                        <Input id="name" name="name" placeholder="e.g. Young Adults - US" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Input id="description" name="description" placeholder="Optional description" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="filterCity">City</Label>
                                        <Input id="filterCity" name="filterCity" placeholder="Any city" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="filterCountry">Country</Label>
                                        <Input id="filterCountry" name="filterCountry" placeholder="Any country" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Gender</Label>
                                        <Select value={gender} onValueChange={setGender}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All</SelectItem>
                                                <SelectItem value="male">Male</SelectItem>
                                                <SelectItem value="female">Female</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="filterAgeMin">Age Min</Label>
                                            <Input id="filterAgeMin" name="filterAgeMin" type="number" placeholder="18" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="filterAgeMax">Age Max</Label>
                                            <Input id="filterAgeMax" name="filterAgeMax" type="number" placeholder="65" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end"><SubmitButton /></CardFooter>
                        </Card>
                    </form>

                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>How Segments Work</AlertTitle>
                        <AlertDescription>
                            Segments filter your audience by demographics. Use them when sending broadcasts to target specific groups instead of your entire subscriber list.
                        </AlertDescription>
                    </Alert>

                    {segments.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {segments.map((seg: any) => (
                                <Card key={seg._id} className="card-gradient card-gradient-blue">
                                    <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg">{seg.name}</CardTitle>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(seg._id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {seg.description && (
                                            <CardDescription>{seg.description}</CardDescription>
                                        )}
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-wrap gap-1.5">
                                            {seg.filterCity && <Badge variant="secondary">City: {seg.filterCity}</Badge>}
                                            {seg.filterCountry && <Badge variant="secondary">Country: {seg.filterCountry}</Badge>}
                                            {seg.filterGender && seg.filterGender !== 'all' && (
                                                <Badge variant="secondary">Gender: {seg.filterGender}</Badge>
                                            )}
                                            {seg.filterAgeMin && <Badge variant="secondary">Age Min: {seg.filterAgeMin}</Badge>}
                                            {seg.filterAgeMax && <Badge variant="secondary">Age Max: {seg.filterAgeMax}</Badge>}
                                        </div>
                                        {seg.createdAt && (
                                            <p className="text-xs text-muted-foreground mt-3">
                                                Created: {new Date(seg.createdAt).toLocaleDateString()}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                            <CardContent>
                                <p className="text-lg font-semibold">No Segments Yet</p>
                                <p>Create your first audience segment above.</p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
