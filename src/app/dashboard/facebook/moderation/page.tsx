'use client';

import { useEffect, useState, useTransition, useCallback, useRef, useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { getModerationRules, saveModerationRule, deleteModerationRule } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Shield, LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add Rule
        </Button>
    );
}

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    );
}

export default function ModerationPage() {
    const [rules, setRules] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [action, setAction] = useState('hide');
    const [state, formAction] = useActionState(saveModerationRule, initialState);
    const formRef = useRef<HTMLFormElement>(null);
    const { toast } = useToast();

    const fetchRules = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const { rules: fetched, error: fetchError } = await getModerationRules(projectId);
            if (fetchError) setError(fetchError);
            else if (fetched) setRules(fetched);
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => { fetchRules(); }, [projectId, fetchRules]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            formRef.current?.reset();
            setAction('hide');
            fetchRules();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, fetchRules]);

    const handleDelete = (ruleId: string) => {
        startTransition(async () => {
            const result = await deleteModerationRule(ruleId);
            if (result.error) toast({ title: 'Error', description: result.error, variant: 'destructive' });
            else fetchRules();
        });
    };

    if (isLoading && rules.length === 0) return <PageSkeleton />;

    const activeRules = rules.filter(r => r.isActive).length;

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Shield className="h-8 w-8" />
                    Comment Moderation
                </h1>
                <p className="text-muted-foreground mt-2">
                    Create rules to automatically moderate comments on your posts.
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Rules</CardTitle>
                            </CardHeader>
                            <CardContent><p className="text-3xl font-bold">{rules.length}</p></CardContent>
                        </Card>
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Active Rules</CardTitle>
                            </CardHeader>
                            <CardContent><p className="text-3xl font-bold">{activeRules}</p></CardContent>
                        </Card>
                    </div>

                    <form action={formAction} ref={formRef}>
                        <input type="hidden" name="projectId" value={projectId} />
                        <input type="hidden" name="action" value={action} />
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader><CardTitle>Add Rule</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                                    <Input id="keywords" name="keywords" placeholder="spam, buy now, click here" required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Action</Label>
                                    <Select value={action} onValueChange={setAction}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="hide">Hide</SelectItem>
                                            <SelectItem value="delete">Delete</SelectItem>
                                            <SelectItem value="auto_reply">Auto Reply</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {action === 'auto_reply' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="autoReplyText">Auto Reply Text</Label>
                                        <Textarea id="autoReplyText" name="autoReplyText" placeholder="Thanks for your comment! We will review it shortly." />
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <Switch id="isActive" name="isActive" defaultChecked />
                                    <Label htmlFor="isActive">Active</Label>
                                </div>
                            </CardContent>
                            <CardFooter className="flex justify-end"><SubmitButton /></CardFooter>
                        </Card>
                    </form>

                    <Card className="card-gradient card-gradient-blue">
                        <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
                        <CardContent>
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Keywords</TableHead>
                                            <TableHead>Action</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="w-16" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rules.length > 0 ? rules.map((rule: any) => (
                                            <TableRow key={rule._id}>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(rule.keywords || []).map((kw: string, i: number) => (
                                                            <Badge key={i} variant="secondary">{kw}</Badge>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge>{rule.action}</Badge></TableCell>
                                                <TableCell>
                                                    <Badge variant={rule.isActive ? 'default' : 'outline'}>
                                                        {rule.isActive ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(rule._id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center h-24">No moderation rules yet.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
