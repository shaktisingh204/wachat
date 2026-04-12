'use client';

import { useEffect, useState, useTransition, useCallback, useActionState } from 'react';
import { getFacebookEvents, handleCreateFacebookEvent, deleteFacebookEvent } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CalendarDays, Trash2, Users, MapPin, Globe, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';

function EventsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <Skeleton className="h-24 w-full" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
            </div>
        </div>
    );
}

export default function EventsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

    const initialState = { message: undefined as string | undefined, error: undefined as string | undefined };
    const [createState, createAction] = useActionState(handleCreateFacebookEvent, initialState);

    const fetchEvents = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const { events: fetched, error: fetchError } = await getFacebookEvents(projectId);
            if (fetchError) {
                setError(fetchError);
            } else if (fetched) {
                setEvents(fetched);
            }
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchEvents();
    }, [projectId, fetchEvents]);

    useEffect(() => {
        if (createState?.message) {
            setShowCreate(false);
            fetchEvents();
        }
    }, [createState, fetchEvents]);

    const handleDelete = (eventId: string) => {
        if (!projectId) return;
        setIsDeletingId(eventId);
        startTransition(async () => {
            const result = await deleteFacebookEvent(eventId, projectId);
            if (result.error) {
                setError(result.error);
            } else {
                fetchEvents();
            }
            setIsDeletingId(null);
        });
    };

    if (isLoading && events.length === 0) {
        return <EventsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <CalendarDays className="h-8 w-8" />
                        Events
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Manage Facebook Page events.
                    </p>
                </div>
                <Button onClick={() => setShowCreate(!showCreate)}>
                    <Plus className="h-4 w-4 mr-2" /> Create Event
                </Button>
            </div>

            {!projectId ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>Please select a project from the main dashboard to view events.</AlertDescription>
                </Alert>
            ) : error ? (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not fetch events</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle></CardHeader>
                            <CardContent><p className="text-3xl font-bold">{events.length}</p></CardContent>
                        </Card>
                    </div>

                    {/* Create Form */}
                    {showCreate && (
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader><CardTitle>Create New Event</CardTitle></CardHeader>
                            <CardContent>
                                <form action={createAction} className="space-y-4">
                                    <input type="hidden" name="projectId" value={projectId} />
                                    {createState?.error && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>{createState.error}</AlertDescription>
                                        </Alert>
                                    )}
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Event Name *</Label>
                                            <Input id="name" name="name" required placeholder="My Event" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="placeName">Place Name</Label>
                                            <Input id="placeName" name="placeName" placeholder="Venue name" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea id="description" name="description" rows={3} placeholder="Event description..." />
                                    </div>
                                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="startDate">Start Date *</Label>
                                            <Input id="startDate" name="startDate" type="date" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="startTime">Start Time *</Label>
                                            <Input id="startTime" name="startTime" type="time" required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="endDate">End Date</Label>
                                            <Input id="endDate" name="endDate" type="date" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="endTime">End Time</Label>
                                            <Input id="endTime" name="endTime" type="time" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" id="isOnline" name="isOnline" className="rounded" />
                                        <Label htmlFor="isOnline">Online Event</Label>
                                    </div>
                                    <Button type="submit">Create Event</Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    {/* Event Cards */}
                    {events.length > 0 ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {events.map((event: any) => (
                                <Card key={event.id} className="card-gradient card-gradient-blue flex flex-col justify-between">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base font-semibold line-clamp-2">{event.name}</CardTitle>
                                        <p className="text-xs text-muted-foreground">
                                            {event.start_time ? formatDistanceToNow(new Date(event.start_time), { addSuffix: true }) : 'No start time'}
                                        </p>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        {event.start_time && (
                                            <p className="text-muted-foreground">
                                                <span className="font-medium text-foreground">Start:</span> {new Date(event.start_time).toLocaleString()}
                                            </p>
                                        )}
                                        {event.end_time && (
                                            <p className="text-muted-foreground">
                                                <span className="font-medium text-foreground">End:</span> {new Date(event.end_time).toLocaleString()}
                                            </p>
                                        )}
                                        {event.place?.name && (
                                            <p className="flex items-center gap-1 text-muted-foreground">
                                                <MapPin className="h-3 w-3" /> {event.place.name}
                                            </p>
                                        )}
                                        {event.is_online && (
                                            <p className="flex items-center gap-1 text-muted-foreground">
                                                <Globe className="h-3 w-3" /> Online Event
                                            </p>
                                        )}
                                        <div className="flex items-center gap-4 pt-2 text-muted-foreground">
                                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {event.attending_count || 0} attending</span>
                                            <span>{event.interested_count || 0} interested</span>
                                        </div>
                                    </CardContent>
                                    <div className="px-6 pb-4 mt-auto">
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            disabled={isDeletingId === event.id}
                                            onClick={() => handleDelete(event.id)}
                                        >
                                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                            <CardContent>
                                <p className="text-lg font-semibold">No Events Found</p>
                                <p>Create your first event to get started.</p>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}
