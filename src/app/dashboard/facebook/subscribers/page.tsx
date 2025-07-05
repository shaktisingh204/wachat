
'use client';

import { useEffect, useState, useTransition, useMemo } from 'react';
import { getFacebookSubscribers } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Users, Search, LoaderCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { FacebookSubscriber } from '@/lib/definitions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDebouncedCallback } from 'use-debounce';

const SUBSCRIBERS_PER_PAGE = 20;

function SubscribersPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
                 <Skeleton className="h-24 w-full" />
                 <Skeleton className="h-24 w-full col-span-2" />
            </div>
            <Card>
                <CardHeader><Skeleton className="h-6 w-1/3"/></CardHeader>
                <CardContent><Skeleton className="h-64 w-full"/></CardContent>
            </Card>
        </div>
    );
}

export default function SubscribersPage() {
    const [subscribers, setSubscribers] = useState<FacebookSubscriber[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    
    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (projectId) {
            startTransition(async () => {
                const { subscribers: fetchedSubscribers, error: fetchError } = await getFacebookSubscribers(projectId);
                if (fetchError) {
                    setError(fetchError);
                } else if (fetchedSubscribers) {
                    setSubscribers(fetchedSubscribers);
                }
            });
        }
    }, [projectId]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1); 
    }, 300);

    const filteredSubscribers = useMemo(() => {
        if (!searchQuery) return subscribers;
        return subscribers.filter(sub => sub.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [subscribers, searchQuery]);

    const totalPages = Math.ceil(filteredSubscribers.length / SUBSCRIBERS_PER_PAGE);
    const paginatedSubscribers = useMemo(() => {
        const startIndex = (currentPage - 1) * SUBSCRIBERS_PER_PAGE;
        const endIndex = startIndex + SUBSCRIBERS_PER_PAGE;
        return filteredSubscribers.slice(startIndex, endIndex);
    }, [filteredSubscribers, currentPage]);


    if (isLoading && subscribers.length === 0) {
        return <SubscribersPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Users className="h-8 w-8"/>
                    Messenger Subscribers
                </h1>
                <p className="text-muted-foreground mt-2">
                    A list of all users who have messaged your Facebook Page.
                </p>
            </div>

             {!projectId ? (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard to view its subscribers.
                    </AlertDescription>
                </Alert>
            ) : error ? (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not fetch subscribers</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : (
                <>
                <Card className="card-gradient card-gradient-green">
                    <CardHeader>
                        <CardTitle>Total Subscribers</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold">{subscribers.length.toLocaleString()}</div>
                    </CardContent>
                </Card>

                <Card className="card-gradient card-gradient-blue">
                    <CardHeader>
                        <CardTitle>Subscriber List</CardTitle>
                        <CardDescription>A complete list of unique users from your Messenger conversations.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4">
                            <div className="relative w-full max-w-sm">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name..."
                                    className="pl-8"
                                    onChange={(e) => handleSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Page-Scoped ID (PSID)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedSubscribers.length > 0 ? (
                                        paginatedSubscribers.map(sub => (
                                            <TableRow key={sub.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar>
                                                            <AvatarImage src={`https://graph.facebook.com/${sub.id}/picture`} alt={sub.name} data-ai-hint="person avatar"/>
                                                            <AvatarFallback>{sub.name.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium">{sub.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">{sub.id}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={2} className="h-24 text-center">No subscribers found.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="flex items-center justify-end space-x-2 py-4">
                            <span className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages > 0 ? totalPages : 1}
                            </span>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage <= 1}>Previous</Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages}>Next</Button>
                        </div>
                    </CardContent>
                </Card>
                </>
            )}
        </div>
    );
}
