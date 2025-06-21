import type { Metadata } from 'next';
import { connectToDatabase } from '@/lib/mongodb';
import { WithId } from 'mongodb';
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

export const metadata: Metadata = {
  title: 'Broadcasts | WABASimplify',
};

type Template = {
  name: string;
  category: string;
  body: string;
};

type Broadcast = {
  templateName: string;
  fileName: string;
  contactCount: number;
  status: 'Completed' | 'Processing' | 'Failed';
  createdAt: string;
};

async function getTemplates(): Promise<WithId<Template>[]> {
  try {
    const { db } = await connectToDatabase();
    const templates = await db.collection<Template>('templates').find({}).sort({ name: 1 }).toArray();
    return templates;
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return [];
  }
}

async function getBroadcastHistory(): Promise<WithId<Broadcast>[]> {
  try {
    const { db } = await connectToDatabase();
    const broadcasts = await db.collection<Broadcast>('broadcasts').find({}).sort({ createdAt: -1 }).limit(10).toArray();
    return broadcasts;
  } catch (error) {
    console.error('Failed to fetch broadcast history:', error);
    return [];
  }
}

export default async function BroadcastPage() {
  const templates = await getTemplates();
  const history = await getBroadcastHistory();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Send Broadcast</h1>
        <p className="text-muted-foreground">
          Send a message template to a list of contacts via CSV upload.
        </p>
      </div>

      <BroadcastForm templates={templates} />

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
                    <TableCell>{item.contactCount}</TableCell>
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
