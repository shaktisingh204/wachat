
'use client';

import { useEffect, useState, useTransition, useActionState, useCallback, useRef } from 'react';
import { getKnowledgeDocs, uploadKnowledgeDoc, deleteKnowledgeDoc } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, BookCopy, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';

const initialFormState = { message: '', error: '' };

function PageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-8 w-64" />
            <div className="grid md:grid-cols-2 gap-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
        </div>
    );
}

export default function KnowledgePage() {
    const [docs, setDocs] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [formState, formAction] = useActionState(uploadKnowledgeDoc, initialFormState);
    const formRef = useRef<HTMLFormElement>(null);

    const fetchDocs = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const { docs: fetched, error: fetchError } = await getKnowledgeDocs(projectId);
            if (fetchError) setError(fetchError);
            else if (fetched) setDocs(fetched);
        });
    }, [projectId]);

    useEffect(() => {
        setProjectId(localStorage.getItem('activeProjectId'));
    }, []);

    useEffect(() => { fetchDocs(); }, [projectId, fetchDocs]);

    useEffect(() => {
        if (formState.message) {
            setShowForm(false);
            formRef.current?.reset();
            fetchDocs();
        }
    }, [formState, fetchDocs]);

    const handleDelete = (docId: string, title: string) => {
        if (!confirm(`Delete "${title}"?`)) return;
        startTransition(async () => {
            await deleteKnowledgeDoc(docId);
            fetchDocs();
        });
    };

    if (isLoading && docs.length === 0) return <PageSkeleton />;

    const totalChars = docs.reduce((sum: number, d: any) => sum + (d.charCount || 0), 0);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <BookCopy className="h-8 w-8" /> Knowledge Base
                    </h1>
                    <p className="text-muted-foreground mt-2">Manage the knowledge sources for your Facebook AI agents.</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Document
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
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Documents</CardTitle></CardHeader>
                            <CardContent><p className="text-3xl font-bold">{docs.length}</p></CardContent>
                        </Card>
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Characters</CardTitle></CardHeader>
                            <CardContent><p className="text-3xl font-bold">{totalChars.toLocaleString()}</p></CardContent>
                        </Card>
                    </div>

                    {/* Upload Form */}
                    {showForm && (
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader><CardTitle className="text-base">New Document</CardTitle></CardHeader>
                            <CardContent>
                                <form ref={formRef} action={formAction} className="space-y-4">
                                    <input type="hidden" name="projectId" value={projectId} />
                                    {formState.error && (
                                        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{formState.error}</AlertDescription></Alert>
                                    )}
                                    <div className="space-y-2">
                                        <Label htmlFor="title">Title *</Label>
                                        <Input id="title" name="title" required placeholder="e.g. Return Policy" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="docType">Document Type</Label>
                                        <Select name="docType" defaultValue="text">
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="text">Text</SelectItem>
                                                <SelectItem value="faq">FAQ</SelectItem>
                                                <SelectItem value="policy">Policy</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="content">Content *</Label>
                                        <Textarea id="content" name="content" required placeholder="Paste your document content here..." rows={8} />
                                    </div>
                                    <Button type="submit">Upload Document</Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    {/* Documents Table */}
                    {docs.length > 0 ? (
                        <Card className="card-gradient card-gradient-blue overflow-hidden">
                            <div className="divide-y divide-border">
                                {docs.map((doc: any) => (
                                    <div key={doc._id}>
                                        <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                                            <button
                                                type="button"
                                                className="flex items-center gap-3 flex-1 text-left"
                                                onClick={() => setExpandedId(expandedId === doc._id ? null : doc._id)}
                                            >
                                                {expandedId === doc._id ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                                                <span className="font-medium">{doc.title}</span>
                                                <Badge variant="secondary" className="text-xs">{doc.docType}</Badge>
                                                <span className="text-sm text-muted-foreground ml-auto mr-4">
                                                    {(doc.charCount || 0).toLocaleString()} chars
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {doc.createdAt ? formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true }) : ''}
                                                </span>
                                            </button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive ml-2"
                                                onClick={() => handleDelete(doc._id, doc.title)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {expandedId === doc._id && (
                                            <div className="px-4 pb-4 pt-1">
                                                <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                                                    {doc.content}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ) : !showForm ? (
                        <Card className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                            <CardContent>
                                <p className="text-lg font-semibold">No Documents Yet</p>
                                <p>Add knowledge documents for your AI agents.</p>
                            </CardContent>
                        </Card>
                    ) : null}
                </>
            )}
        </div>
    );
}
