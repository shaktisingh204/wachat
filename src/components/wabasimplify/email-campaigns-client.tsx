
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { WithId, CrmEmailTemplate, EmailCampaign } from '@/lib/definitions';
import { getCrmEmailTemplates } from '@/app/actions/crm-email-templates.actions';
import { getEmailCampaigns } from '@/app/actions/email.actions';
import { EmailCampaignForm } from './email-campaign-form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '../ui/badge';

function ClientSkeleton() {
    return (
        <div className="grid lg:grid-cols-3 gap-8 items-start">
            <Skeleton className="lg:col-span-2 h-96" />
            <Skeleton className="h-64" />
        </div>
    )
}

export function EmailCampaignsClient() {
    const [templates, setTemplates] = useState<WithId<CrmEmailTemplate>[]>([]);
    const [campaigns, setCampaigns] = useState<WithId<EmailCampaign>[]>([]);
    const [isLoading, startLoading] = useTransition();

    const fetchData = () => {
        startLoading(async () => {
            const [templatesData, campaignsData] = await Promise.all([
                getCrmEmailTemplates(),
                getEmailCampaigns()
            ]);
            setTemplates(templatesData);
            setCampaigns(campaignsData);
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2">
                <EmailCampaignForm templates={templates} onSuccess={fetchData} />
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Recent Campaigns</CardTitle>
                    <CardDescription>A log of your recent email sends.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <Skeleton className="h-48 w-full"/> : 
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Campaign</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {campaigns.length > 0 ? campaigns.map(c => (
                                    <TableRow key={c._id.toString()}>
                                        <TableCell>
                                            <p className="font-medium">{c.name}</p>
                                            <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt), {addSuffix: true})}</p>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={c.status === 'sent' ? 'default' : 'secondary'}>{c.status}</Badge>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center h-24">No campaigns sent yet.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    }
                </CardContent>
            </Card>
        </div>
    )
}
