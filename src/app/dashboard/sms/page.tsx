
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Send, Users, TrendingUp, CheckCircle, XCircle, Database, Server, FileText, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useProject } from '@/context/project-context';
import { getSmsCampaigns, getSmsContacts } from '@/app/actions/sms.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import type { WithId, SmsCampaign, SmsTemplate, SmsActivityLog } from '@/lib/definitions';

const StatCard = ({ title, value, icon: Icon, description }: { title: string, value: string | number, icon: React.ElementType, description?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

// Mock data for new components
const mockTemplates: SmsTemplate[] = [
    { id: '1', name: 'promotional_offer_v2', content: 'Hi {{1}}, our sale ends in 3 hours! Use code SAVE20.', status: 'Approved' },
    { id: '2', name: 'appointment_reminder', content: 'Reminder: Your appointment is at {{1}} tomorrow.', status: 'Approved' },
    { id: '3', name: 'new_collection_alert', content: 'The new collection has arrived! Check it out.', status: 'Pending' },
    { id: '4', name: 'shipping_update', content: 'Your order #{{1}} has shipped!', status: 'Rejected' },
];

const mockActivity: SmsActivityLog[] = [
    { id: '1', type: 'Campaign', name: 'Diwali Sale Blast', status: 'Completed', date: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    { id: '2', type: 'Single Send', name: 'to +919876543210', status: 'Completed', date: new Date(Date.now() - 5 * 60 * 60 * 1000) },
    { id: '3', type: 'Campaign', name: 'Weekend Offer', status: 'In Progress', date: new Date() },
];

const operatorHealth = [
    { name: 'Jio', status: 'Operational' },
    { name: 'Airtel', status: 'Operational' },
    { name: 'Vodafone Idea', status: 'Degraded Performance' },
    { name: 'BSNL', status: 'Operational' },
];

function PageSkeleton() {
    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Skeleton className="h-96" />
                <Skeleton className="h-96" />
            </div>
        </div>
    );
}

export default function SmsDashboardPage() {
    const { activeProjectId } = useProject();
    const [stats, setStats] = useState({ campaigns: 0, contacts: 0, messagesSent: 0, deliveryRate: '0.0' });
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        if (activeProjectId) {
            startTransition(async () => {
                const [campaignsData, contactsData] = await Promise.all([
                    getSmsCampaigns(activeProjectId),
                    getSmsContacts(activeProjectId)
                ]);
                const totalSent = campaignsData.reduce((sum, c) => sum + (c.successCount || 0), 0);
                const totalFailed = campaignsData.reduce((sum, c) => sum + (c.failedCount || 0), 0);
                const deliveryRate = totalSent > 0 ? ((totalSent / (totalSent + totalFailed)) * 100).toFixed(1) : '0.0';
                
                setStats({
                    campaigns: campaignsData.length,
                    contacts: contactsData.length,
                    messagesSent: totalSent,
                    deliveryRate: deliveryRate
                });
            });
        }
    }, [activeProjectId]);

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!activeProjectId) {
        return (
            <Alert variant="destructive" className="max-w-xl mx-auto">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to view the SMS dashboard.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                 <StatCard title="Total Contacts" value={stats.contacts.toLocaleString()} icon={Users} />
                 <StatCard title="Total Campaigns" value={stats.campaigns} icon={Send} />
                 <StatCard title="Messages Sent" value={stats.messagesSent.toLocaleString()} icon={CheckCircle} />
                 <StatCard title="Delivery Rate" value={`${stats.deliveryRate}%`} icon={TrendingUp} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Recent SMS Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableBody>
                                {mockActivity.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell><Badge variant={item.status === 'Completed' ? 'default' : 'secondary'}>{item.status}</Badge></TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">{formatDistanceToNow(item.date, { addSuffix: true })}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5"/> DLT Sync Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                        <StatCard title="Synced Headers" value="12" icon={FileText} />
                        <StatCard title="Synced Templates" value="45" icon={FileText} />
                    </CardContent>
                    <CardFooter>
                        <Button variant="outline" size="sm">Sync with DLT Portal</Button>
                    </CardFooter>
                </Card>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader><CardTitle>Template Approval Status</CardTitle></CardHeader>
                    <CardContent>
                         <Table>
                             <TableHeader>
                                 <TableRow><TableHead>Template Name</TableHead><TableHead>Status</TableHead></TableRow>
                             </TableHeader>
                            <TableBody>
                                {mockTemplates.map(template => (
                                    <TableRow key={template.id}>
                                        <TableCell>{template.name}</TableCell>
                                        <TableCell><Badge variant={template.status === 'Approved' ? 'default' : template.status === 'Pending' ? 'secondary' : 'destructive'}>{template.status}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-5 w-5"/> Operator API Health</CardTitle></CardHeader>
                    <CardContent>
                         <div className="space-y-3">
                            {operatorHealth.map(op => (
                                <div key={op.name} className="flex justify-between items-center text-sm">
                                    <span className="flex items-center gap-2"><Smartphone className="h-4 w-4"/> {op.name}</span>
                                    <div className="flex items-center gap-2">
                                        <div className={`h-2 w-2 rounded-full ${op.status === 'Operational' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                                        {op.status}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
