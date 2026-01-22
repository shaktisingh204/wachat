
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getCustomAudiences } from '@/app/actions/ad-manager.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { CustomAudience } from '@/lib/definitions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

function AudiencesPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <Card>
                <CardHeader><Skeleton className="h-6 w-1/3"/></CardHeader>
                <CardContent><Skeleton className="h-64 w-full"/></CardContent>
            </Card>
        </div>
    );
}

export default function AudiencesPage() {
    const [audiences, setAudiences] = useState<CustomAudience[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [adAccountId, setAdAccountId] = useState<string | null>(null);

    useEffect(() => {
        const storedAdAccountId = localStorage.getItem('activeAdAccountId');
        setAdAccountId(storedAdAccountId);
    }, []);

    useEffect(() => {
        if (adAccountId) {
            startTransition(async () => {
                const { audiences: fetchedAudiences, error: fetchError } = await getCustomAudiences(adAccountId);
                if (fetchError) {
                    setError(fetchError);
                } else if (fetchedAudiences) {
                    setAudiences(fetchedAudiences);
                }
            });
        }
    }, [adAccountId]);

    const getStatusVariant = (code: number) => {
        if (code === 200) return 'default'; // Ready
        if (code < 400) return 'secondary'; // In progress
        return 'destructive'; // Error
    };

    if (isLoading && audiences.length === 0) {
        return <AudiencesPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Users className="h-8 w-8"/>
                    Audiences
                </h1>
                <p className="text-muted-foreground mt-2">
                    Manage and create custom audiences for your ad campaigns.
                </p>
            </div>

            {!adAccountId ? (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Ad Account Selected</AlertTitle>
                    <AlertDescription>
                        Please select an Ad Account from the Ad Accounts page to view its audiences.
                    </AlertDescription>
                </Alert>
            ) : error ? (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not fetch audiences</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Custom Audiences</CardTitle>
                        <CardDescription>A list of custom audiences in your connected ad account.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Delivery Status</TableHead>
                                        <TableHead>Last Updated</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {audiences.length > 0 ? (
                                        audiences.map(audience => (
                                            <TableRow key={audience.id}>
                                                <TableCell className="font-medium">{audience.name}</TableCell>
                                                <TableCell>&gt; {audience.approximate_count_lower_bound.toLocaleString()}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getStatusVariant(audience.delivery_status.code)}>
                                                        {audience.delivery_status.description}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{new Date(audience.time_updated * 1000).toLocaleDateString()}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">No custom audiences found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
