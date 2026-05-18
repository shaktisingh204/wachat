'use client';

import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruButton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruBadge,
} from '@/components/zoruui';
import {
  useState,
  useEffect } from "react";
import { deleteSmsCampaign,
  getSmsCampaigns } from "@/app/actions/sms-campaign-list.actions";
import { format } from "date-fns";
import { Loader2,
  Plus,
  Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SmsCampaignsList() {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        loadCampaigns();
    }, []);

    const loadCampaigns = async () => {
        setLoading(true);
        const data = await getSmsCampaigns();
        setCampaigns(data);
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this campaign? Logs will be preserved.")) return;
        await deleteSmsCampaign(id);
        loadCampaigns();
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'COMPLETED': return <ZoruBadge variant="success">Completed</ZoruBadge>;
            case 'SENDING': return <ZoruBadge variant="info" className="animate-pulse">Sending</ZoruBadge>;
            case 'PROCESSING': return <ZoruBadge variant="info">Processing</ZoruBadge>;
            case 'FAILED': return <ZoruBadge variant="danger">Failed</ZoruBadge>;
            case 'DRAFT': return <ZoruBadge variant="ghost">Draft</ZoruBadge>;
            case 'SCHEDULED': return <ZoruBadge variant="warning">Scheduled</ZoruBadge>;
            default: return <ZoruBadge variant="ghost">{status}</ZoruBadge>;
        }
    };

    return (
        <ZoruCard className="w-full p-0">
            <ZoruCardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <ZoruCardTitle>All Campaigns</ZoruCardTitle>
                        <ZoruCardDescription>Manage your SMS marketing campaigns.</ZoruCardDescription>
                    </div>
                    <ZoruButton asChild>
                        <Link href="/dashboard/sms/campaigns/new">
                            <Plus className="h-4 w-4" /> New Campaign
                        </Link>
                    </ZoruButton>
                </div>
            </ZoruCardHeader>
            <ZoruCardContent>
                <div className="rounded-md border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow>
                                <ZoruTableHead>Name</ZoruTableHead>
                                <ZoruTableHead>Status</ZoruTableHead>
                                <ZoruTableHead>Sent / Failed</ZoruTableHead>
                                <ZoruTableHead>Created At</ZoruTableHead>
                                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {loading ? (
                                <ZoruTableRow>
                                    <ZoruTableCell colSpan={5} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : campaigns.length === 0 ? (
                                <ZoruTableRow>
                                    <ZoruTableCell colSpan={5} className="h-24 text-center text-zoru-ink-muted">
                                        No campaigns found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                campaigns.map((c) => (
                                    <ZoruTableRow key={c._id}>
                                        <ZoruTableCell className="text-zoru-ink">
                                            {c.name}
                                            {c.error && <p className="text-xs text-zoru-danger-ink mt-1">{c.error}</p>}
                                        </ZoruTableCell>
                                        <ZoruTableCell>{getStatusBadge(c.status)}</ZoruTableCell>
                                        <ZoruTableCell>
                                            <span className="text-zoru-success-ink">{c.stats?.sent || 0}</span> /
                                            <span className="text-zoru-danger-ink ml-1">{c.stats?.failed || 0}</span>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink-muted">
                                            {format(new Date(c.createdAt), 'MMM d, yyyy h:mm a')}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <ZoruButton
                                                variant="ghost"
                                                size="sm"
                                                className="text-zoru-danger-ink hover:text-zoru-danger"
                                                onClick={() => handleDelete(c._id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </ZoruButton>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCardContent>
        </ZoruCard>
    );
}
