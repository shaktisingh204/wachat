'use client';

import { useEffect, useState } from 'react';
import { CreateTemplateForm } from '@/components/wabasimplify/create-template-form';
import Link from 'next/link';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function CreateTemplatePage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]); // New state for logs

  const addLog = (message: string) => {
    // Add log with timestamp
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
  };

  useEffect(() => {
    document.title = 'Create Template | WABASimplify';
    addLog("Page mounted. Getting project ID from local storage...");
    const storedProjectId = localStorage.getItem('activeProjectId');
    if (storedProjectId) {
      addLog(`Found project ID: ${storedProjectId}`);
    } else {
      addLog("No project ID found in local storage.");
    }
    setProjectId(storedProjectId);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-4">
          <Link href="/dashboard/templates">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Templates
          </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline">Create New Message Template</h1>
        <p className="text-muted-foreground">Design your template, get AI suggestions, and submit it for approval.</p>
      </div>

      {loading && (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
            <div className="lg:col-span-1">
                <Skeleton className="h-96 w-full" />
            </div>
         </div>
      )}
      
      {!loading && !projectId && (
         <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Project Selected</AlertTitle>
            <AlertDescription>
                Please select a project from the main dashboard before creating a template.
            </AlertDescription>
        </Alert>
      )}

      {!loading && projectId && <CreateTemplateForm projectId={projectId} addLog={addLog} />}

      {/* Log Viewer */}
      <Card>
        <CardHeader>
            <CardTitle>Live Debug Log</CardTitle>
            <CardDescription>This panel shows live events and API responses as you interact with the page.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="bg-muted p-4 rounded-lg h-64 overflow-y-auto text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                {logs.length > 0 ? logs.map((log, i) => (
                    <p key={i}>{log}</p>
                )) : 'Logs will appear here...'}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
