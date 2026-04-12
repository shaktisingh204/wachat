
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { getFacebookPosts, getScheduledPosts } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarPost {
    id: string;
    message?: string;
    date: string; // YYYY-MM-DD
    type: 'published' | 'scheduled';
}

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-[500px] w-full" />
        </div>
    );
}

function getDaysInMonth(year: number, month: number) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
}

function formatDateKey(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CalendarPage() {
    const [posts, setPosts] = useState<CalendarPost[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());

    const fetchData = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const [pubResult, schedResult] = await Promise.all([
                getFacebookPosts(projectId),
                getScheduledPosts(projectId),
            ]);
            if (pubResult.error && schedResult.error) {
                setError(pubResult.error);
                return;
            }
            const combined: CalendarPost[] = [];
            (pubResult.posts || []).forEach((p: any) => {
                if (p.created_time) {
                    combined.push({
                        id: p.id,
                        message: p.message,
                        date: p.created_time.substring(0, 10),
                        type: 'published',
                    });
                }
            });
            (schedResult.posts || []).forEach((p: any) => {
                const time = p.scheduled_publish_time || p.created_time;
                if (time) {
                    const dateStr = typeof time === 'number'
                        ? new Date(time * 1000).toISOString().substring(0, 10)
                        : String(time).substring(0, 10);
                    combined.push({
                        id: p.id,
                        message: p.message,
                        date: dateStr,
                        type: 'scheduled',
                    });
                }
            });
            setPosts(combined);
        });
    }, [projectId]);

    useEffect(() => {
        setProjectId(localStorage.getItem('activeProjectId'));
    }, []);

    useEffect(() => { fetchData(); }, [projectId, fetchData]);

    const goToPrev = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const goToNext = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    if (isLoading && posts.length === 0) return <PageSkeleton />;

    const days = getDaysInMonth(viewYear, viewMonth);
    const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    const monthLabel = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

    // Group posts by date
    const postsByDate: Record<string, CalendarPost[]> = {};
    posts.forEach(p => {
        if (!postsByDate[p.date]) postsByDate[p.date] = [];
        postsByDate[p.date].push(p);
    });

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <CalendarDays className="h-8 w-8" /> Post Calendar
                </h1>
                <p className="text-muted-foreground mt-2">View your published and scheduled Facebook posts on a calendar.</p>
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
                <Card className="card-gradient card-gradient-blue">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <Button variant="ghost" size="icon" onClick={goToPrev}><ChevronLeft className="h-5 w-5" /></Button>
                            <CardTitle className="text-lg">{monthLabel}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={goToNext}><ChevronRight className="h-5 w-5" /></Button>
                        </div>
                        {/* Legend */}
                        <div className="flex gap-4 text-xs text-muted-foreground justify-center pt-2">
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block" /> Published</span>
                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Scheduled</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Weekday headers */}
                        <div className="grid grid-cols-7 gap-1 mb-1">
                            {WEEKDAYS.map(d => (
                                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                            ))}
                        </div>
                        {/* Day cells */}
                        <div className="grid grid-cols-7 gap-1">
                            {days.map((day, i) => {
                                if (day === null) return <div key={`empty-${i}`} className="min-h-[80px]" />;
                                const dateKey = formatDateKey(viewYear, viewMonth, day);
                                const dayPosts = postsByDate[dateKey] || [];
                                const isToday = dateKey === todayKey;
                                const pubCount = dayPosts.filter(p => p.type === 'published').length;
                                const schedCount = dayPosts.filter(p => p.type === 'scheduled').length;
                                const firstPost = dayPosts[0];

                                return (
                                    <div key={dateKey}
                                        className={`min-h-[80px] rounded-md border p-1.5 text-xs transition-colors ${
                                            isToday ? 'border-blue-500 bg-blue-500/10' : 'border-border/50 hover:bg-muted/30'
                                        }`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`font-medium ${isToday ? 'text-blue-400' : ''}`}>{day}</span>
                                            <div className="flex gap-0.5">
                                                {pubCount > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-blue-500/20 text-blue-400">{pubCount}</Badge>}
                                                {schedCount > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-amber-500/20 text-amber-400">{schedCount}</Badge>}
                                            </div>
                                        </div>
                                        {firstPost && (
                                            <p className="line-clamp-2 text-muted-foreground leading-tight">
                                                {firstPost.message?.substring(0, 50) || 'Media post'}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
