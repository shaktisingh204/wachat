
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Mail, Send, Archive, Trash2, Inbox, Star, Plus } from 'lucide-react';
import { useState } from 'react';
import { ComposeEmailDialog } from '@/components/wabasimplify/crm-compose-email-dialog';
import { format } from 'date-fns';

const mockEmails = [
    { id: 1, from: 'Elena Vance', subject: 'Re: Project Proposal', body: 'Thanks for sending that over, looks great. Let\'s schedule a call for next week to discuss the final details.', date: new Date(Date.now() - 2 * 60 * 60 * 1000), read: false, tag: 'Proposal' },
    { id: 2, from: 'John Doe', subject: 'Question about your service', body: 'Hi, I was wondering if you offer custom packages? I have a few specific requirements for my team.', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), read: true, tag: 'Inquiry' },
    { id: 3, from: 'Acme Corp', subject: 'Invoice #1234 Due', body: 'This is a reminder that your invoice is due next week. Please let us know if you have any questions.', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), read: true, tag: 'Billing' },
];

export default function EmailIntegrationPage() {
    const [selectedEmail, setSelectedEmail] = useState(mockEmails[0]);
    const [isComposeOpen, setIsComposeOpen] = useState(false);

    return (
        <>
            <ComposeEmailDialog isOpen={isComposeOpen} onOpenChange={setIsComposeOpen} />
            <div className="flex flex-col gap-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Mail /> Email Integration</h1>
                        <p className="text-muted-foreground">Manage your email communications directly within the CRM.</p>
                    </div>
                     <Button onClick={() => setIsComposeOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Compose
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[70vh]">
                    <div className="md:col-span-4 lg:col-span-3">
                        <Card className="h-full flex flex-col">
                            <CardHeader>
                                <CardTitle>Inbox</CardTitle>
                            </CardHeader>
                            <CardContent className="p-2 flex-1">
                                <Table>
                                    <TableBody>
                                        {mockEmails.map(email => (
                                            <TableRow 
                                                key={email.id} 
                                                onClick={() => setSelectedEmail(email)}
                                                className={`cursor-pointer ${selectedEmail.id === email.id ? 'bg-muted' : ''}`}
                                            >
                                                <TableCell>
                                                    <div className="font-semibold">{email.from}</div>
                                                    <div className="text-sm text-muted-foreground truncate">{email.subject}</div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant={email.tag === 'Proposal' ? 'default' : 'secondary'}>{email.tag}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="md:col-span-8 lg:col-span-9">
                        <Card className="h-full flex flex-col">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div className="space-y-1">
                                        <CardTitle>{selectedEmail.subject}</CardTitle>
                                        <CardDescription>From: {selectedEmail.from} | {format(selectedEmail.date, 'PPP p')}</CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon"><Archive className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <Separator />
                            <CardContent className="flex-1 py-4">
                                <p>{selectedEmail.body}</p>
                            </CardContent>
                            <CardFooter>
                                <Button variant="outline"><Send className="mr-2 h-4 w-4"/>Reply</Button>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
