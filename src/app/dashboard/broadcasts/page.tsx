
'use client';

import { useState, useEffect } from 'react';
import type { WithId } from 'mongodb';
import { getTemplates, getProjectById, getBroadcasts } from '@/app/actions';
import type { Project, Template } from '@/app/dashboard/page';
import { BroadcastForm } from '@/components/wabasimplify/broadcast-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

type Broadcast = {
  _id: any;
  templateName: string;
  fileName: string;
  contactCount: number;
  successCount?: number;
  errorCount?: number;
  status: 'QUEUED' | 'PROCESSING' | 'Completed' | 'Failed' | 'Partial Failure';
  createdAt: string;
  successfulSends?: { phone: string; response: any }[];
  failedSends?: { phone: string; response: any }[];
};

export default function BroadcastPage() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [history, setHistory] = useState<WithId<Broadcast>[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBroadcast, setSelectedBroadcast] = useState<WithId<Broadcast> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const storedProjectId = localStorage.getItem('activeProjectId');
    
    async function fetchData() {
      setLoading(true);
      try {
        if (storedProjectId) {
          const [projectData, templatesData, historyData] = await Promise.all([
            getProjectById(storedProjectId),
            getTemplates(storedProjectId),
            getBroadcasts(),
          ]);
          setProject(projectData as WithId<Project> | null);
          setTemplates(templatesData as WithId<Template>[]);
          setHistory(historyData as WithId<Broadcast>[]);
        }
      } catch (error) {
        console.error("Failed to fetch broadcast data:", error);
        toast({
          title: "Error",
          description: "Failed to load page data. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [toast]);

  useEffect(() => {
    const hasActiveBroadcasts = history.some(
      (b) => b.status === 'QUEUED' || b.status === 'PROCESSING'
    );

    if (!hasActiveBroadcasts || loading) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const historyData = await getBroadcasts();
        setHistory(historyData as WithId<Broadcast>[]);
      } catch (error) {
        console.error("Failed to poll broadcast history:", error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [history, loading]);

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="space-y-2">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">Send Broadcast</h1>
          <p className="text-muted-foreground">
            Send a message template to a list of contacts via CSV or XLSX upload.
          </p>
        </div>

        <BroadcastForm templates={templates} project={project} />

        <Card>
          <CardHeader>
            <CardTitle>Broadcast History</CardTitle>
            <CardDescription>A log of your 10 most recent broadcast campaigns.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length > 0 ? (
                  history.map((item) => (
                    <TableRow key={item._id.toString()}>
                      <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{item.templateName}</TableCell>
                      <TableCell>{item.fileName}</TableCell>
                      <TableCell>{item.contactCount}</TableCell>
                      <TableCell>
                        {item.successCount !== undefined
                          ? `${item.successCount} sent, ${item.errorCount || 0} failed`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === 'QUEUED'
                              ? 'outline'
                              : item.status === 'PROCESSING'
                              ? 'secondary'
                              : item.status === 'Completed'
                              ? 'default'
                              : item.status === 'Partial Failure'
                              ? 'secondary'
                              : 'destructive'
                          }
                          className="capitalize"
                        >
                          {item.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedBroadcast(item)}>
                            Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No broadcast history found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedBroadcast} onOpenChange={(isOpen) => !isOpen && setSelectedBroadcast(null)}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle>Broadcast Details</DialogTitle>
                <DialogDescription>
                    Template: {selectedBroadcast?.templateName} | File: {selectedBroadcast?.fileName}
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] mt-4">
              <div className="pr-6">
                <Accordion type="multiple" className="w-full space-y-4">
                    <AccordionItem value="success">
                        <AccordionTrigger>Successful Sends ({selectedBroadcast?.successfulSends?.length || 0})</AccordionTrigger>
                        <AccordionContent>
                        {selectedBroadcast?.successfulSends && selectedBroadcast.successfulSends.length > 0 ? (
                            selectedBroadcast.successfulSends.map((s, i) => (
                                <div key={i} className="mb-2 p-2 border-b">
                                    <p className="font-semibold text-sm">To: {s.phone}</p>
                                    <pre className="mt-1 text-xs bg-muted/50 p-2 rounded-md whitespace-pre-wrap font-code">
                                        {JSON.stringify(s.response, null, 2)}
                                    </pre>
                                </div>
                            ))
                        ) : <p className="text-sm text-muted-foreground p-2">No successful sends to show.</p>}
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="failure">
                        <AccordionTrigger className="text-destructive hover:text-destructive focus:text-destructive">Failed Sends ({selectedBroadcast?.failedSends?.length || 0})</AccordionTrigger>
                        <AccordionContent>
                        {selectedBroadcast?.failedSends && selectedBroadcast.failedSends.length > 0 ? (
                            selectedBroadcast.failedSends.map((f, i) => (
                                <div key={i} className="mb-2 p-2 border-b">
                                    <p className="font-semibold text-sm">To: {f.phone}</p>
                                    <pre className="mt-1 text-xs bg-muted/50 p-2 rounded-md whitespace-pre-wrap font-code">
                                        {JSON.stringify(f.response, null, 2)}
                                    </pre>
                                </div>
                            ))
                        ) : <p className="text-sm text-muted-foreground p-2">No failed sends to show.</p>}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
              </div>
            </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
