'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { getLeadGenForms, getLeadsForForm } from '@/app/actions/facebook.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, FileText, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';

function LeadsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <div className="grid md:grid-cols-3 gap-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full md:col-span-2" />
            </div>
        </div>
    );
}

export default function LeadsPage() {
    const [forms, setForms] = useState<any[]>([]);
    const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
    const [leads, setLeads] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const [isLoadingLeads, startLeadsTransition] = useTransition();
    const [projectId, setProjectId] = useState<string | null>(null);

    const fetchForms = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const { forms: fetched, error: fetchError } = await getLeadGenForms(projectId);
            if (fetchError) {
                setError(fetchError);
            } else if (fetched) {
                setForms(fetched);
            }
        });
    }, [projectId]);

    const fetchLeads = useCallback((formId: string) => {
        if (!projectId) return;
        setSelectedFormId(formId);
        setLeads([]);
        startLeadsTransition(async () => {
            const { leads: fetched, error: fetchError } = await getLeadsForForm(formId, projectId);
            if (fetchError) {
                setError(fetchError);
            } else if (fetched) {
                setLeads(fetched);
            }
        });
    }, [projectId]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchForms();
    }, [projectId, fetchForms]);

    if (isLoading && forms.length === 0) {
        return <LeadsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <FileText className="h-8 w-8" />
                    Lead Generation
                </h1>
                <p className="text-muted-foreground mt-2">
                    View lead gen forms and their submitted leads.
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
                <div className="grid md:grid-cols-3 gap-6">
                    {/* Forms List */}
                    <div className="space-y-3">
                        <h2 className="text-lg font-semibold">Forms ({forms.length})</h2>
                        {forms.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No lead gen forms found.</p>
                        ) : (
                            forms.map((form: any) => (
                                <Card
                                    key={form.id}
                                    className={`card-gradient card-gradient-blue cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${selectedFormId === form.id ? 'ring-2 ring-primary' : ''}`}
                                    onClick={() => fetchLeads(form.id)}
                                >
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="font-medium text-sm line-clamp-1">{form.name}</p>
                                            <Badge variant={form.status === 'ACTIVE' ? 'default' : 'secondary'}
                                                className={form.status === 'ACTIVE' ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700'}>
                                                {form.status}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {form.leads_count || 0} leads</span>
                                            {form.created_time && (
                                                <span>{formatDistanceToNow(new Date(form.created_time), { addSuffix: true })}</span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    {/* Leads Table */}
                    <div className="md:col-span-2">
                        <Card className="card-gradient card-gradient-blue">
                            <CardHeader>
                                <CardTitle className="text-base">
                                    {selectedFormId ? 'Leads' : 'Select a form to view leads'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoadingLeads ? (
                                    <div className="space-y-3">
                                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                                    </div>
                                ) : !selectedFormId ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        Click on a form from the left panel to load its leads.
                                    </p>
                                ) : leads.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">No leads found for this form.</p>
                                ) : (
                                    <div className="overflow-auto max-h-[600px]">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Created</TableHead>
                                                    <TableHead>Field Data</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {leads.map((lead: any) => (
                                                    <TableRow key={lead.id}>
                                                        <TableCell className="text-xs whitespace-nowrap">
                                                            {lead.created_time ? formatDistanceToNow(new Date(lead.created_time), { addSuffix: true }) : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            {lead.field_data?.map((field: any, i: number) => (
                                                                <div key={i}>
                                                                    <span className="font-medium">{field.name}:</span>{' '}
                                                                    {Array.isArray(field.values) ? field.values.join(', ') : String(field.values)}
                                                                </div>
                                                            )) || '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
