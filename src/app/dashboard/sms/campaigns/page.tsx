'use client';

import { useState, useEffect } from "react";
import { deleteSmsCampaign, getSmsCampaigns } from "@/app/actions/sms-campaign-list.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
            case 'COMPLETED': return <Badge className="bg-green-500">Completed</Badge>;
            case 'SENDING': return <Badge className="bg-blue-500 animate-pulse">Sending</Badge>;
            case 'PROCESSING': return <Badge className="bg-blue-400">Processing</Badge>;
            case 'FAILED': return <Badge variant="destructive">Failed</Badge>;
            case 'DRAFT': return <Badge variant="secondary">Draft</Badge>;
            case 'SCHEDULED': return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Scheduled</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>All Campaigns</CardTitle>
                        <CardDescription>Manage your SMS marketing campaigns.</CardDescription>
                    </div>
                    <Button asChild>
                        <Link href="/dashboard/sms/campaigns/new">
                            <Plus className="h-4 w-4 mr-2" /> New Campaign
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Sent / Failed</TableHead>
                                <TableHead>Created At</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : campaigns.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No campaigns found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                campaigns.map((c) => (
                                    <TableRow key={c._id}>
                                        <TableCell className="font-medium">
                                            {c.name}
                                            {c.error && <p className="text-xs text-red-500 mt-1">{c.error}</p>}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(c.status)}</TableCell>
                                        <TableCell>
                                            <span className="text-green-600 font-medium">{c.stats?.sent || 0}</span> /
                                            <span className="text-red-500 font-medium ml-1">{c.stats?.failed || 0}</span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {format(new Date(c.createdAt), 'MMM d, yyyy h:mm a')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-700"
                                                onClick={() => handleDelete(c._id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
