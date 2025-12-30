
'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import type { WithId } from 'mongodb';
import { getProjectById } from '@/app/actions/index.ts';
import { getPhoneNumberCallingSettings } from '@/app/actions/calling.actions';
import type { Project, PhoneNumber, CallingSettings } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Phone, FileText, ChevronUp, ChevronDown, Check, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CallingSettingsForm } from '@/components/wabasimplify/calling-settings-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useProject } from '@/context/project-context';

function SettingsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div className="space-y-2">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-10 w-full md:w-1/2" />
            <Skeleton className="h-[400px] w-full" />
        </div>
    );
}

const ApiLogRow = ({ log }: { log: any }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    return (
        <div className="p-3 border-b last:border-0 text-sm">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{log.method}</span>
                    <Badge variant={log.status === 'SUCCESS' ? 'default' : 'destructive'}>{log.status}</Badge>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}</span>
                    <button>{isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
                </div>
            </div>
            {isExpanded && (
                <div className="mt-2 space-y-2">
                    <h4 className="font-semibold text-xs uppercase text-muted-foreground">Payload</h4>
                    <pre className="p-2 bg-muted rounded-md text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                        {JSON.stringify(log.payload, null, 2)}
                    </pre>
                     {log.errorMessage && (
                        <>
                             <h4 className="font-semibold text-xs uppercase text-muted-foreground">Error Response</h4>
                             <pre className="p-2 bg-destructive/10 text-destructive rounded-md text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                                {log.errorMessage}
                            </pre>
                        </>
                    )}
                     {log.response && (
                        <>
                             <h4 className="font-semibold text-xs uppercase text-muted-foreground">Success Response</h4>
                             <pre className="p-2 bg-green-500/10 text-green-700 rounded-md text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                                {JSON.stringify(log.response, null, 2)}
                            </pre>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};


export default function CallingSettingsPage() {
    const { activeProject, activeProjectId } = useProject();
    const [isLoading, startLoadingTransition] = useTransition();
    const [selectedPhone, setSelectedPhone] = useState<PhoneNumber | null>(null);
    const [apiLogs, setApiLogs] = useState<any[]>([]);

    const fetchData = useCallback(() => {
        if (!activeProjectId) return;
        startLoadingTransition(async () => {
            // Re-fetch project to ensure phone numbers are up to date
            await getProjectById(activeProjectId);
        });
    }, [activeProjectId]);

    useEffect(() => {
        if (activeProject?.phoneNumbers && activeProject.phoneNumbers.length > 0 && !selectedPhone) {
            setSelectedPhone(activeProject.phoneNumbers[0]);
        }
    }, [activeProject, selectedPhone]);
    
    if (isLoading && !activeProject) return <SettingsPageSkeleton />;

    if (!activeProject) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to configure its calling settings.
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 flex flex-col gap-6">
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Configure Number</h2>
                    <p className="text-muted-foreground">
                        Select a phone number to view and modify its calling configuration.
                    </p>
                </div>
                
                <div className="max-w-md">
                    <Select 
                        value={selectedPhone?.id} 
                        onValueChange={(id) => setSelectedPhone(activeProject.phoneNumbers.find(p => p.id === id) || null)}
                    >
                        <SelectTrigger><SelectValue placeholder="Select a phone number..." /></SelectTrigger>
                        <SelectContent>
                            {activeProject.phoneNumbers.map(phone => (
                                <SelectItem key={phone.id} value={phone.id}>
                                    {phone.display_phone_number} ({phone.verified_name})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {selectedPhone ? (
                    <CallingSettingsForm 
                        key={selectedPhone.id} 
                        project={activeProject} 
                        phone={selectedPhone}
                        onSuccess={fetchData}
                    />
                ) : (
                    <Alert>
                        <Phone className="h-4 w-4" />
                        <AlertTitle>No Phone Number Selected</AlertTitle>
                        <AlertDescription>
                        Please select a phone number from the dropdown above to manage its settings.
                        </AlertDescription>
                    </Alert>
                )}
            </div>
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div className="space-y-1.5">
                                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/> API Call Log</CardTitle>
                                <CardDescription>A log of recent API calls made from this page.</CardDescription>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => fetchData()} disabled={isLoading}><RefreshCw className="h-4 w-4"/></Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                         <ScrollArea className="h-96">
                            {apiLogs.length > 0 ? (
                                apiLogs.map(log => <ApiLogRow key={log._id} log={log} />)
                            ) : (
                                <div className="p-8 text-center text-sm text-muted-foreground">No API calls logged yet.</div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

