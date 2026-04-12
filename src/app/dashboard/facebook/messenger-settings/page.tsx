'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import {
    getMessengerProfile,
    setMessengerGreeting,
    setMessengerGetStarted,
    setMessengerIceBreakers,
    setWhitelistedDomains,
    getSavedResponses,
    createSavedResponse,
    deleteSavedResponse,
    getMessagingFeatureReview,
} from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, MessageSquare, Plus, Trash2, Save, Globe, Snowflake, MessageCircleQuestion, CheckCircle, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function SettingsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
        </div>
    );
}

export default function MessengerSettingsPage() {
    const [profile, setProfile] = useState<any>(null);
    const [savedResponses, setSavedResponses] = useState<any[]>([]);
    const [features, setFeatures] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [isSaving, startSaveTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    // Form states
    const [greetingText, setGreetingText] = useState('');
    const [getStartedPayload, setGetStartedPayload] = useState('');
    const [iceBreakers, setIceBreakers] = useState<{ question: string; payload: string }[]>([{ question: '', payload: '' }]);
    const [domains, setDomains] = useState<string[]>(['']);
    const [newResponseTitle, setNewResponseTitle] = useState('');
    const [newResponseMessage, setNewResponseMessage] = useState('');

    const fetchData = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const [profileRes, responsesRes, featuresRes] = await Promise.all([
                getMessengerProfile(projectId),
                getSavedResponses(projectId),
                getMessagingFeatureReview(projectId),
            ]);

            if (profileRes.error) {
                setError(profileRes.error);
            } else if (profileRes.profile) {
                setProfile(profileRes.profile);
                const p = profileRes.profile;
                if (p.greeting?.[0]?.text) setGreetingText(p.greeting[0].text);
                if (p.get_started?.payload) setGetStartedPayload(p.get_started.payload);
                if (p.ice_breakers?.length > 0) {
                    setIceBreakers(p.ice_breakers.map((ib: any) => ({
                        question: ib.call_to_actions?.[0]?.question || ib.question || '',
                        payload: ib.call_to_actions?.[0]?.payload || ib.payload || '',
                    })));
                }
                if (p.whitelisted_domains?.length > 0) {
                    setDomains(p.whitelisted_domains);
                }
            }

            if (responsesRes.responses) setSavedResponses(responsesRes.responses);
            if (featuresRes.features) setFeatures(featuresRes.features);
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchData();
    }, [projectId, fetchData]);

    const handleSaveGreeting = () => {
        if (!projectId) return;
        startSaveTransition(async () => {
            const result = await setMessengerGreeting(projectId, greetingText);
            if (result.error) setError(result.error);
        });
    };

    const handleSaveGetStarted = () => {
        if (!projectId) return;
        startSaveTransition(async () => {
            const result = await setMessengerGetStarted(projectId, getStartedPayload);
            if (result.error) setError(result.error);
        });
    };

    const handleSaveIceBreakers = () => {
        if (!projectId) return;
        const validIceBreakers = iceBreakers.filter(ib => ib.question && ib.payload);
        if (validIceBreakers.length === 0) return;
        startSaveTransition(async () => {
            const result = await setMessengerIceBreakers(projectId, validIceBreakers);
            if (result.error) setError(result.error);
        });
    };

    const handleSaveDomains = () => {
        if (!projectId) return;
        const validDomains = domains.filter(d => d.trim());
        if (validDomains.length === 0) return;
        startSaveTransition(async () => {
            const result = await setWhitelistedDomains(projectId, validDomains);
            if (result.error) setError(result.error);
        });
    };

    const handleAddSavedResponse = () => {
        if (!projectId || !newResponseTitle || !newResponseMessage) return;
        startSaveTransition(async () => {
            const fd = new FormData();
            fd.append('projectId', projectId);
            fd.append('title', newResponseTitle);
            fd.append('message', newResponseMessage);
            const result = await createSavedResponse({ message: undefined, error: undefined }, fd);
            if (result.error) {
                setError(result.error);
            } else {
                setNewResponseTitle('');
                setNewResponseMessage('');
                fetchData();
            }
        });
    };

    const handleDeleteResponse = (responseId: string) => {
        if (!projectId) return;
        startSaveTransition(async () => {
            const result = await deleteSavedResponse(responseId, projectId);
            if (result.error) setError(result.error);
            else fetchData();
        });
    };

    if (isLoading && !profile) {
        return <SettingsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <MessageSquare className="h-8 w-8" />
                    Messenger Settings
                </h1>
                <p className="text-muted-foreground mt-2">
                    Configure Messenger profile, greetings, ice breakers, and more.
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
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Greeting Text */}
                    <Card className="card-gradient card-gradient-blue">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" /> Greeting Text
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Textarea
                                value={greetingText}
                                onChange={(e) => setGreetingText(e.target.value)}
                                placeholder="Hi {{user_first_name}}! Welcome to our page."
                                rows={3}
                            />
                            <Button size="sm" onClick={handleSaveGreeting} disabled={isSaving}>
                                <Save className="h-3 w-3 mr-1" /> Save
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Get Started Button */}
                    <Card className="card-gradient card-gradient-blue">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <MessageCircleQuestion className="h-4 w-4" /> Get Started Button
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-2">
                                <Label>Payload</Label>
                                <Input
                                    value={getStartedPayload}
                                    onChange={(e) => setGetStartedPayload(e.target.value)}
                                    placeholder="GET_STARTED_PAYLOAD"
                                />
                            </div>
                            <Button size="sm" onClick={handleSaveGetStarted} disabled={isSaving}>
                                <Save className="h-3 w-3 mr-1" /> Save
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Ice Breakers */}
                    <Card className="card-gradient card-gradient-blue">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Snowflake className="h-4 w-4" /> Ice Breakers
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {iceBreakers.map((ib, i) => (
                                <div key={i} className="grid grid-cols-2 gap-2">
                                    <Input
                                        value={ib.question}
                                        onChange={(e) => {
                                            const updated = [...iceBreakers];
                                            updated[i] = { ...updated[i], question: e.target.value };
                                            setIceBreakers(updated);
                                        }}
                                        placeholder="Question"
                                    />
                                    <div className="flex gap-1">
                                        <Input
                                            value={ib.payload}
                                            onChange={(e) => {
                                                const updated = [...iceBreakers];
                                                updated[i] = { ...updated[i], payload: e.target.value };
                                                setIceBreakers(updated);
                                            }}
                                            placeholder="Payload"
                                        />
                                        {iceBreakers.length > 1 && (
                                            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                                                onClick={() => setIceBreakers(iceBreakers.filter((_, j) => j !== i))}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIceBreakers([...iceBreakers, { question: '', payload: '' }])}>
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                                <Button size="sm" onClick={handleSaveIceBreakers} disabled={isSaving}>
                                    <Save className="h-3 w-3 mr-1" /> Save
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Whitelisted Domains */}
                    <Card className="card-gradient card-gradient-blue">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Globe className="h-4 w-4" /> Whitelisted Domains
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {domains.map((domain, i) => (
                                <div key={i} className="flex gap-1">
                                    <Input
                                        value={domain}
                                        onChange={(e) => {
                                            const updated = [...domains];
                                            updated[i] = e.target.value;
                                            setDomains(updated);
                                        }}
                                        placeholder="https://example.com"
                                    />
                                    {domains.length > 1 && (
                                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0"
                                            onClick={() => setDomains(domains.filter((_, j) => j !== i))}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setDomains([...domains, ''])}>
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                                <Button size="sm" onClick={handleSaveDomains} disabled={isSaving}>
                                    <Save className="h-3 w-3 mr-1" /> Save
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Saved Responses */}
                    <Card className="card-gradient card-gradient-blue md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base">Saved Responses</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-3 gap-2">
                                <Input value={newResponseTitle} onChange={(e) => setNewResponseTitle(e.target.value)} placeholder="Title" />
                                <Input value={newResponseMessage} onChange={(e) => setNewResponseMessage(e.target.value)} placeholder="Message text" />
                                <Button onClick={handleAddSavedResponse} disabled={isSaving || !newResponseTitle || !newResponseMessage}>
                                    <Plus className="h-4 w-4 mr-1" /> Add Response
                                </Button>
                            </div>
                            {savedResponses.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Message</TableHead>
                                            <TableHead>Enabled</TableHead>
                                            <TableHead className="w-12"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {savedResponses.map((resp: any) => (
                                            <TableRow key={resp.id}>
                                                <TableCell className="font-medium text-sm">{resp.title}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground line-clamp-1">{resp.message}</TableCell>
                                                <TableCell>
                                                    {resp.is_enabled ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteResponse(resp.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No saved responses.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Feature Review Status */}
                    <Card className="card-gradient card-gradient-blue md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base">Messaging Feature Review</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {features.length > 0 ? (
                                <div className="space-y-2">
                                    {features.map((feature: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-2 rounded border border-border/50">
                                            <span className="text-sm font-medium">{feature.feature}</span>
                                            <Badge variant={feature.status === 'approved' ? 'default' : 'secondary'}
                                                className={feature.status === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}>
                                                {feature.status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No feature review data available.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
