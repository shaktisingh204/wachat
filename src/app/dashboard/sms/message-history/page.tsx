

'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getSmsHistory } from '@/app/actions/sms.actions';
import type { SmsMessage, DltSmsTemplate, SmsHeader, User } from '@/lib/definitions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, LoaderCircle, History } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';
import { getSession } from '@/app/actions';
import { format } from 'date-fns';

const MESSAGES_PER_PAGE = 20;

const getStatusVariant = (status?: string): "default" | "secondary" | "destructive" | "outline" => {
    if (!status) return 'outline';
    const s = status.toLowerCase();
    if (s === 'delivered') return 'default';
    if (s === 'sent' || s === 'queued' || s === 'sending') return 'secondary';
    if (s === 'failed' || s === 'undelivered') return 'destructive';
    return 'outline';
};

export default function MessageHistoryPage() {
    const [user, setUser] = useState<WithId<User> | null>(null);
    const [messages, setMessages] = useState<WithId<SmsMessage>[]>([]);
    const [isLoading, startTransition] = useTransition();
    
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    
    const templates = user?.smsProviderSettings?.dltTemplates || [];
    const headers = user?.smsProviderSettings?.headers || [];

    const fetchData = useCallback((page: number, query: string, status: string) => {
        startTransition(async () => {
            const result = await getSmsHistory(page, MESSAGES_PER_PAGE, query, status === 'all' ? undefined : status);
            setMessages(result.messages);
            setTotalPages(Math.ceil(result.total / MESSAGES_PER_PAGE));
        });
    }, []);

    useEffect(() => {
        getSession().then(session => setUser(session?.user || null));
        fetchData(currentPage, searchQuery, statusFilter);
    }, [currentPage, searchQuery, statusFilter, fetchData]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1);
    }, 300);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History className="h-5 w-5"/>Message History</CardTitle>
                    <CardDescription>A detailed log of all outgoing SMS messages.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4 mb-4">
                        <div className="relative flex-grow max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by recipient or message..."
                                className="pl-8"
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                                <SelectItem value="undelivered">Undelivered</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>To</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Message</TableHead>
                                    <TableHead>Template / Sender</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                    ))
                                ) : messages.length > 0 ? (
                                    messages.map(msg => (
                                        <TableRow key={msg._id.toString()}>
                                            <TableCell className="text-xs text-muted-foreground">{format(new Date(msg.createdAt), 'PPp')}</TableCell>
                                            <TableCell className="font-mono text-xs">{msg.to}</TableCell>
                                            <TableCell><Badge variant={getStatusVariant(msg.status)}>{msg.status}</Badge></TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{msg.body}</TableCell>
                                            <TableCell>
                                                <div className="text-xs">
                                                    <p>{templates.find(t => t.dltTemplateId === msg.dltTemplateId)?.name || 'N/A'}</p>
                                                    <p className="font-mono">{msg.senderId || 'Default'}</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No messages found for the current filters.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                     <div className="flex items-center justify-end space-x-2 py-4">
                        <span className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages > 0 ? totalPages : 1}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage <= 1 || isLoading}>Previous</Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages || isLoading}>Next</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

    