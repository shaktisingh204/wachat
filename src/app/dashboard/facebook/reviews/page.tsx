'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { getPageRatings } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

function ReviewsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <Skeleton className="h-24 w-48" />
            <div className="space-y-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
        </div>
    );
}

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
                <Star
                    key={star}
                    className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
                />
            ))}
        </div>
    );
}

export default function ReviewsPage() {
    const [ratings, setRatings] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    const fetchRatings = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const { ratings: fetched, error: fetchError } = await getPageRatings(projectId);
            if (fetchError) {
                setError(fetchError);
            } else if (fetched) {
                setRatings(fetched);
            }
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchRatings();
    }, [projectId, fetchRatings]);

    if (isLoading && ratings.length === 0) {
        return <ReviewsPageSkeleton />;
    }

    const avgRating = ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.filter(r => r.has_rating).length).toFixed(1)
        : '0';

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Star className="h-8 w-8" />
                    Reviews & Ratings
                </h1>
                <p className="text-muted-foreground mt-2">
                    Page ratings and reviews from your audience.
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
                    {/* Average Rating Card */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Average Rating</CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-center gap-3">
                                <p className="text-3xl font-bold">{avgRating}</p>
                                <StarRating rating={Math.round(Number(avgRating))} />
                            </CardContent>
                        </Card>
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Reviews</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">{ratings.length}</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Reviews List */}
                    {ratings.length > 0 ? (
                        <div className="space-y-4">
                            {ratings.map((review: any, index: number) => (
                                <Card key={review.id || index} className="card-gradient card-gradient-blue">
                                    <CardContent className="p-5">
                                        <div className="flex items-start gap-4">
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage src={review.reviewer?.picture?.data?.url} />
                                                <AvatarFallback>
                                                    {review.reviewer?.name?.charAt(0) || '?'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-medium text-sm">{review.reviewer?.name || 'Anonymous'}</p>
                                                    {review.created_time && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatDistanceToNow(new Date(review.created_time), { addSuffix: true })}
                                                        </span>
                                                    )}
                                                </div>
                                                {review.has_rating && <StarRating rating={review.rating} />}
                                                {review.review_text && (
                                                    <p className="text-sm text-muted-foreground mt-2">{review.review_text}</p>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                            <CardContent>
                                <p className="text-lg font-semibold">No Reviews Found</p>
                                <p>No ratings or reviews have been left on your page yet.</p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
