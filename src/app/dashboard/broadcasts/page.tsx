'use client';

import { useState, useEffect } from 'react';
import type { WithId } from 'mongodb';
import { getTemplates, getProjectById, getBroadcasts } from '@/app/actions';
import type { Project } from '@/app/dashboard/page';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type Template = {
  name: string;
  category: string;
  body: string;
};

type Broadcast = {
  templateName: string;
  fileName: string;
  contactCount: number;
  successCount?: number;
  errorCount?: number;
  status: 'Completed' | 'Processing' | 'Failed' | 'Partial Failure';
  createdAt: string;
};

export default function BroadcastPage() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [templates, setTemplates] = useState<WithId<Template>[]>([]);
  const [history, setHistory] = useState<WithId<Broadcast>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedProjectId = localStorage.getItem('activeProjectId');
    
    async function fetchData() {
      if (storedProjectId) {
        const [projectData, templatesData, historyData] = await Promise.all([
          getProjectById(storedProjectId),
          getTemplates(),
          getBroadcasts(),
        ]);
        setProject(projectData as WithId<Project>);
        setTemplates(templatesData as WithId<Template>[]);
        setHistory(historyData as WithId<Broadcast>[]);
      }
      setLoading(false);
    }

    fetchData();
  }, []);

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
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Send Broadcast</h1>
        <p className="text-muted-foreground">
          Send a message template to a list of contacts via CSV upload.
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
                <TableHead>Sent</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length > 0 ? (
                history.map((item) => (
                  <TableRow key={item._id.toString()}>
                    <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{item.templateName}</TableCell>
                    <TableCell>{item.fileName}</TableCell>
                    <TableCell>
                      {item.successCount !== undefined
                        ? `${item.successCount} / ${item.contactCount}`
                        : item.contactCount}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === 'Processing'
                            ? 'secondary'
                            : item.status === 'Completed'
                            ? 'default'
                            : 'destructive'
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No broadcast history found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
