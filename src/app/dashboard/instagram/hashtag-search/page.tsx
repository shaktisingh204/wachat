
'use client';

import { useState, useTransition, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Search, NotebookPen, Image as ImageIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import Link from 'next/link';
import { searchHashtagId, getHashtagRecentMedia } from '@/app/actions/instagram.actions';
import { formatDistanceToNow } from 'date-fns';

function SearchPageSkeleton() {
    return (
        <div className="space-y-6">
            <Card><CardHeader><Skeleton className="h-10 w-full" /></CardHeader></Card>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="aspect-square w-full" />)}
            </div>
        </div>
    );
}

export default function HashtagSearchPage() {
    const [hashtag, setHashtag] = useState('technology');
    const [media, setMedia] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();

    const handleSearch = () => {
        if (!hashtag.trim()) return;
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (!storedProjectId) {
            setError("No active project selected. Please select a project from the connections page.");
            return;
        }

        startTransition(async () => {
            setError(null);
            setMedia([]);
            const idResult = await searchHashtagId(hashtag, storedProjectId);
            if (idResult.error || !idResult.hashtagId) {
                setError(idResult.error || `Could not find a hashtag ID for "${hashtag}".`);
                return;
            }
            const mediaResult = await getHashtagRecentMedia(idResult.hashtagId, storedProjectId);
            if (mediaResult.error) {
                setError(mediaResult.error);
            } else {
                setMedia(mediaResult.media || []);
            }
        });
    };
    
    // Initial search on load
    useState(() => {
        handleSearch();
    });

    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <NotebookPen className="h-8 w-8"/>
                    Hashtag Search
                </h1>
                <p className="text-muted-foreground mt-2">
                   Discover recent public posts for any hashtag.
                </p>
            </div>
            
             <Card>
                <CardContent className="p-4 flex gap-2">
                    <Input
                        placeholder="Enter a hashtag (without #)..."
                        value={hashtag}
                        onChange={(e) => setHashtag(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={isLoading}>
                        <Search className="mr-2 h-4 w-4"/>
                        Search
                    </Button>
                </CardContent>
            </Card>
            
            {isLoading && <SearchPageSkeleton />}

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {!isLoading && !error && (
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {media.length > 0 ? media.map((item) => (
                        <Link key={item.id} href={item.permalink || '#'} target="_blank" rel="noopener noreferrer" className="block relative aspect-square group">
                            <Image src={item.media_url || 'https://placehold.co/400x400.png'} alt={item.caption || 'Hashtag Post'} layout="fill" objectFit="cover" className="rounded-md" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4">
                                <p className="text-white text-xs text-center line-clamp-4">{item.caption}</p>
                                <p className="text-white/70 text-xs mt-2">{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</p>
                            </div>
                        </Link>
                    )) : (
                         <div className="col-span-full text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                            <ImageIcon className="mx-auto h-12 w-12" />
                            <h3 className="mt-4 text-lg font-semibold">No Recent Media</h3>
                            <p className="mt-1 text-sm">No recent public posts found for this hashtag.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
