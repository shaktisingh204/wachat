'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Users,
    UserPlus,
    Trophy,
    DollarSign,
    Handshake,
    Calendar,
    Briefcase,
    FileText,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface RecentDealsCardProps {
    deals: any[];
    currency: string;
}

export const RecentDealsCard = ({ deals, currency }: RecentDealsCardProps) => (
    <Card className="col-span-1 md:col-span-2">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Handshake className="h-5 w-5 text-primary" />
                Recent Deals
            </CardTitle>
            <CardDescription>Latest deals created in your pipeline</CardDescription>
        </CardHeader>
        <CardContent>
            {deals.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <Handshake className="h-12 w-12 mb-4 opacity-20" />
                    <p>No recent deals found.</p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Deal Name</TableHead>
                            <TableHead>Stage</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {deals.map((deal) => (
                            <TableRow key={deal._id}>
                                <TableCell className="font-medium">{deal.name}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="text-xs">
                                        {deal.stage}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency || 'USD' }).format(deal.value || 0)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
    </Card>
);

interface UpcomingTasksCardProps {
    tasks: any[];
}

export const UpcomingTasksCard = ({ tasks }: UpcomingTasksCardProps) => (
    <Card className="col-span-1">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Upcoming Tasks
            </CardTitle>
            <CardDescription>Scheduled activities needing attention</CardDescription>
        </CardHeader>
        <CardContent>
            {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mb-4 opacity-20" />
                    <p>No pending tasks.</p>
                </div>
            ) : (
                <ScrollArea className="h-[250px] pr-4">
                    <div className="space-y-4">
                        {tasks.map((task) => (
                            <div key={task._id} className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0">
                                <div className="space-y-1">
                                    <p className="font-medium text-sm leading-none">{task.title}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Badge variant={task.priority === 'High' ? 'destructive' : 'outline'} className="text-[10px] px-1 py-0 h-4">
                                            {task.priority || 'Normal'}
                                        </Badge>
                                        {task.dueDate && <span>{format(new Date(task.dueDate), 'MMM d, yyyy')}</span>}
                                    </div>
                                </div>
                                <div className="bg-primary/10 p-1.5 rounded-full">
                                    {task.type === 'Call' ? <Users className="h-3 w-3 text-primary" /> : <FileText className="h-3 w-3 text-primary" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            )}
        </CardContent>
    </Card>
);

interface PipelineBreakdownCardProps {
    stages: { stage: string; count: number; value: number }[];
    currency: string;
}

export const PipelineBreakdownCard = ({ stages, currency }: PipelineBreakdownCardProps) => (
    <Card className="col-span-1 md:col-span-2">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Pipeline Breakdown
            </CardTitle>
            <CardDescription>Distribution of deals across stages</CardDescription>
        </CardHeader>
        <CardContent>
            {stages.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mb-4 opacity-20" />
                    <p>No active pipeline data.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {stages.map((item, index) => (
                        <div key={index} className="flex items-center">
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-medium leading-none">{item.stage}</p>
                                <p className="text-xs text-muted-foreground">{item.count} deals</p>
                            </div>
                            <div className="font-bold">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(item.value)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </CardContent>
    </Card>
);

interface RecentContactsCardProps {
    contacts: any[];
}

export const RecentContactsCard = ({ contacts }: RecentContactsCardProps) => (
    <Card className="col-span-1">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Recent Contacts
            </CardTitle>
            <CardDescription>New leads added to CRM</CardDescription>
        </CardHeader>
        <CardContent>
            {contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <Users className="h-12 w-12 mb-4 opacity-20" />
                    <p>No contacts found.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {contacts.map((contact) => (
                        <div key={contact._id} className="flex items-center justify-between space-x-4">
                            <div className="flex items-center space-x-4">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                                    <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-medium leading-none">{contact.name}</p>
                                    <p className="text-xs text-muted-foreground">{contact.email}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </CardContent>
    </Card>
);

interface InvoiceStatsCardProps {
    stats: { overdueCount: number; overdueAmount: number; sentCount: number; sentAmount: number };
    currency: string;
}

export const InvoiceSummaryCard = ({ stats, currency }: InvoiceStatsCardProps) => (
    <Card className="col-span-1">
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Invoices
            </CardTitle>
            <CardDescription>Overview of pending payments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-l-4 border-destructive pl-4 py-2 bg-destructive/5 rounded-r-md">
                <div>
                    <p className="text-sm font-medium">Overdue</p>
                    <p className="text-2xl font-bold text-destructive">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(stats.overdueAmount)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground">Invoices</p>
                    <p className="text-lg font-semibold">{stats.overdueCount}</p>
                </div>
            </div>

            <div className="flex items-center justify-between border-l-4 border-blue-500 pl-4 py-2 bg-blue-500/5 rounded-r-md">
                <div>
                    <p className="text-sm font-medium">Sent (Due)</p>
                    <p className="text-2xl font-bold text-blue-600">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(stats.sentAmount)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground">Invoices</p>
                    <p className="text-lg font-semibold">{stats.sentCount}</p>
                </div>
            </div>
        </CardContent>
    </Card>
);
