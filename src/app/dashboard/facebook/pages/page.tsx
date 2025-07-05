

'use client';

import { useEffect, useState, useTransition } from 'react';
import { getFacebookPages } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Link as LinkIcon, Newspaper } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { FacebookPage } from '@/lib/definitions';

function PagesPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
            </div>
        </div>
    );
}

export default function AllFacebookPagesPage() {
    const [pages, setPages] = useState<FacebookPage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        if (projectId) {
            startTransition(async () => {
                const { pages: fetchedPages, error: fetchError } = await getFacebookPages(projectId);
                if (fetchError) {
                    setError(fetchError);
                } else if (fetchedPages) {
                    setPages(fetchedPages);
                }
            });
        }
    }, [projectId]);

    const pageTitle = "Connected Pages";
    const pageDescription = "A list of all Facebook Pages you have granted access to.";
    
    if (isLoading && pages.length === 0) {
        return <PagesPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Newspaper className="h-8 w-8"/>
                    {pageTitle}
                </h1>
                <p className="text-muted-foreground mt-2">{pageDescription}</p>
            </div>

            {!projectId ? (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard to view its connected pages.
                    </AlertDescription>
                </Alert>
            ) : error ? (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not fetch pages</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : pages.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pages.map(page => (
                        <Card key={page.id}>
                            <CardHeader className="flex-row items-center gap-4">
                                <Avatar>
                                    <AvatarImage src={`https://graph.facebook.com/${page.id}/picture?type=square`} alt={page.name} data-ai-hint="logo company"/>
                                    <AvatarFallback>{page.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <CardTitle className="text-base">{page.name}</CardTitle>
                                    <CardDescription>{page.category}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Button variant="outline" asChild className="w-full">
                                    <Link href={`https://facebook.com/${page.id}`} target="_blank">
                                        <LinkIcon className="mr-2 h-4 w-4"/>
                                        View Page
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                 <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <CardContent>
                        <p className="text-lg font-semibold">No Pages Found</p>
                        <p>No Facebook Pages were found for the connected account.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
