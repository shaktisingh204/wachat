
'use client';

import { useState, useEffect, useTransition } from 'react';
import { ZoruCard, ZoruCardHeader, ZoruCardTitle, ZoruCardContent, ZoruCardDescription } from "@/components/ui/card";
import { ZoruButton } from "@/components/ui/button";
import { PlusCircle, Send } from "lucide-react";
import { ZoruSkeleton } from "@/components/ui/skeleton";
import type { WithId, CrmEmailTemplate, EmailCampaign } from '@/lib/definitions';
import { getCrmEmailTemplates } from '@/app/actions/crm-email-templates.actions';
import { getEmailCampaigns } from '@/app/actions/email.actions';
import { EmailCampaignForm } from './email-campaign-form';
import { ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow } from '@/components/zoruui';
import { formatDistanceToNow } from 'date-fns';
import { ZoruBadge } from '../ui/badge';

function ClientSkeleton() {
    return (
        <div className="grid lg:grid-cols-3 gap-8 items-start">
            <ZoruSkeleton className="lg:col-span-2 h-96" />
            <ZoruSkeleton className="h-64" />
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
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Recent Campaigns</ZoruCardTitle>
                    <ZoruCardDescription>A log of your recent email sends.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    {isLoading ? <ZoruSkeleton className="h-48 w-full"/> : 
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Campaign</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {campaigns.length > 0 ? campaigns.map(c => (
                                    <ZoruTableRow key={c._id.toString()}>
                                        <ZoruTableCell>
                                            <p className="font-medium">{c.name}</p>
                                            <p className="text-xs text-muted-foreground">{c.sentAt ? formatDistanceToNow(new Date(c.sentAt), {addSuffix: true}) : 'Scheduled'}</p>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <ZoruBadge variant={c.status === 'sent' ? 'default' : 'secondary'}>{c.status}</ZoruBadge>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                )) : (
                                    <ZoruTableRow>
                                        <ZoruTableCell colSpan={2} className="text-center h-24">No campaigns sent yet.</ZoruTableCell>
                                    </ZoruTableRow>
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    }
                </ZoruCardContent>
            </ZoruCard>
        </div>
    )
}
