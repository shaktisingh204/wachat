
'use client';

import { useEffect, useState, useTransition, useActionState, useCallback, useRef } from 'react';
import { getFacebookAgents, createFacebookAgent, updateFacebookAgent, deleteFacebookAgent } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Bot, Plus, Trash2, Power } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

const initialFormState = { message: '', error: '' };

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-8 w-64" />
            <div className="grid md:grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
        </div>
    );
}

export default function AgentsPage() {
    const [agents, setAgents] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [formState, formAction] = useActionState(createFacebookAgent, initialFormState);
    const formRef = useRef<HTMLFormElement>(null);

    const fetchAgents = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const { agents: fetched, error: fetchError } = await getFacebookAgents(projectId);
            if (fetchError) setError(fetchError);
            else if (fetched) setAgents(fetched);
        });
    }, [projectId]);

    useEffect(() => {
        setProjectId(localStorage.getItem('activeProjectId'));
    }, []);

    useEffect(() => { fetchAgents(); }, [projectId, fetchAgents]);

    useEffect(() => {
        if (formState.message) {
            setShowForm(false);
            formRef.current?.reset();
            fetchAgents();
        }
    }, [formState, fetchAgents]);

    const handleToggle = (agentId: string, currentActive: boolean) => {
        startTransition(async () => {
            await updateFacebookAgent(agentId, { isActive: !currentActive });
            fetchAgents();
        });
    };

    const handleDelete = (agentId: string, name: string) => {
        if (!confirm(`Delete agent "${name}"?`)) return;
        startTransition(async () => {
            await deleteFacebookAgent(agentId);
            fetchAgents();
        });
    };

    if (isLoading && agents.length === 0) return <PageSkeleton />;

    const activeCount = agents.filter(a => a.isActive).length;

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Bot className="h-8 w-8" /> AI Agents
                    </h1>
                    <p className="text-muted-foreground mt-2">Build, manage, and deploy conversational AI agents for Messenger.</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    <Plus className="h-4 w-4 mr-2" /> Create Agent
                </Button>
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
                    {/* Stats */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Agents</CardTitle></CardHeader>
                            <CardContent><p className="text-3xl font-bold">{agents.length}</p></CardContent>
                        </Card>
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Agents</CardTitle></CardHeader>
                            <CardContent><p className="text-3xl font-bold">{activeCount}</p></CardContent>
                        </Card>
                    </div>

                    {/* Create Form */}
                    {showForm && (
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader><CardTitle className="text-base">New Agent</CardTitle></CardHeader>
                            <CardContent>
                                <form ref={formRef} action={formAction} className="space-y-4">
                                    <input type="hidden" name="projectId" value={projectId} />
                                    {formState.error && (
                                        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{formState.error}</AlertDescription></Alert>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Name *</Label>
                                        <Input id="name" name="name" required placeholder="e.g. Support Bot" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="personality">Personality</Label>
                                        <Textarea id="personality" name="personality" placeholder="friendly and helpful" rows={2} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="welcomeMessage">Welcome Message</Label>
                                        <Textarea id="welcomeMessage" name="welcomeMessage" placeholder="Hi! How can I help you today?" rows={2} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="fallbackMessage">Fallback Message</Label>
                                        <Textarea id="fallbackMessage" name="fallbackMessage" placeholder="Let me connect you with a human agent." rows={2} />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Switch id="isActive" name="isActive" />
                                        <Label htmlFor="isActive">Active</Label>
                                    </div>
                                    <Button type="submit">Create Agent</Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    {/* Agents Grid */}
                    {agents.length > 0 ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {agents.map((agent: any) => (
                                <Card key={agent._id} className="card-gradient card-gradient-blue flex flex-col justify-between">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-base font-semibold">{agent.name}</CardTitle>
                                            <Badge variant={agent.isActive ? 'default' : 'secondary'}
                                                className={agent.isActive ? 'bg-green-600 hover:bg-green-700' : ''}>
                                                {agent.isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm text-muted-foreground flex-1">
                                        <p className="line-clamp-2">{agent.personality || 'No personality set'}</p>
                                    </CardContent>
                                    <div className="flex items-center justify-between p-4 pt-0">
                                        <Button variant="ghost" size="sm" onClick={() => handleToggle(agent._id, agent.isActive)}>
                                            <Power className="h-4 w-4 mr-1" /> {agent.isActive ? 'Deactivate' : 'Activate'}
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(agent._id, agent.name)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : !showForm ? (
                        <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                            <CardContent>
                                <p className="text-lg font-semibold">No Agents Yet</p>
                                <p>Create your first AI agent to get started.</p>
                            </CardContent>
                        </Card>
                    ) : null}
                </>
            )}
        </div>
    );
}
