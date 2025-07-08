
'use client';

import { useEffect, useState } from 'react';
import { getProjectById } from '@/app/actions';
import type { WithId } from 'mongodb';
import type { Project, PaymentConfiguration, BusinessCapabilities } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Banknote, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b py-3 gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold text-left sm:text-right">{value}</dd>
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-2/3 mt-2" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/4" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/4" />
                         <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function ProjectInformationPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [loading, setLoading] = useState(true);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (isClient) {
            document.title = "Project Information | Wachat";
            const storedProjectId = localStorage.getItem('activeProjectId');
            if (storedProjectId) {
                getProjectById(storedProjectId).then(data => {
                    setProject(data);
                }).finally(() => {
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        }
    }, [isClient]);

    const getReviewStatusVariant = (status?: string) => {
        if (!status) return 'outline';
        const lowerStatus = status.toLowerCase();
        if (lowerStatus === 'approved' || lowerStatus === 'verified') return 'default';
        if (lowerStatus.includes('pending') || lowerStatus.includes('unknown')) return 'secondary';
        return 'destructive';
    };

    if (!isClient || loading) {
        return <LoadingSkeleton />;
    }

    if (!project) {
        return (
            <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Project Information</h1>
                    <p className="text-muted-foreground">General and technical details about your project.</p>
                </div>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard page to see its information.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }
    
    const paymentConfig: PaymentConfiguration | undefined = project.paymentConfiguration;
    const businessCaps: BusinessCapabilities | undefined = project.businessCapabilities;

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Project Information</h1>
                <p className="text-muted-foreground">General and technical details for "{project.name}".</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Briefcase className="h-5 w-5" />
                            General Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="space-y-1">
                            <InfoRow label="Project Name" value={project.name} />
                            <InfoRow label="WABA ID" value={<span className="font-mono text-sm break-all">{project.wabaId}</span>} />
                            <InfoRow label="Project ID" value={<span className="font-mono text-sm break-all">{project._id.toString()}</span>} />
                            <InfoRow label="Created At" value={new Date(project.createdAt).toLocaleString()} />
                            <InfoRow label="Account Review" value={
                                <Badge variant={getReviewStatusVariant(project.reviewStatus)} className="capitalize">
                                    {project.reviewStatus?.replace(/_/g, ' ') || 'Unknown'}
                                </Badge>
                            } />
                            {businessCaps && (
                                <>
                                    <div className="pt-2" />
                                    <Separator />
                                    <div className="pt-2" />
                                    <InfoRow label="Daily Conversation Limit" value={businessCaps.max_daily_conversation_per_phone?.toLocaleString() ?? 'N/A'} />
                                    <InfoRow label="Phone Number Limit" value={businessCaps.max_phone_numbers_per_business?.toLocaleString() ?? 'N/A'} />
                                </>
                            )}
                        </dl>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Banknote className="h-5 w-5" />
                            Payment Configuration
                        </CardTitle>
                        <CardDescription>Details for payment integrations received via webhook.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {paymentConfig ? (
                             <dl className="space-y-1">
                                <InfoRow label="Provider Name" value={<span className="capitalize">{paymentConfig.provider_name}</span>} />
                                <InfoRow label="Configuration Name" value={paymentConfig.configuration_name} />
                                <InfoRow label="Provider MID" value={<span className="font-mono text-sm break-all">{paymentConfig.provider_mid}</span>} />
                                <InfoRow label="Status" value={<Badge variant={paymentConfig.status === 'Needs Testing' ? 'secondary' : 'default'}>{paymentConfig.status}</Badge>} />
                                <InfoRow label="Last Updated" value={new Date(paymentConfig.updated_timestamp * 1000).toLocaleString()} />
                            </dl>
                        ) : (
                            <div className="text-center text-muted-foreground py-8">
                                <p>No payment configuration data received for this project yet.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
