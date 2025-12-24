
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getPaymentConfigurations } from '@/app/actions/whatsapp-pay.actions';
import { getProjectById } from '@/app/actions/index.ts';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ExternalLink, RefreshCw, LoaderCircle, CheckCircle, PlusCircle, Settings, Link as LinkIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WaPayIcon } from "@/components/wabasimplify/custom-sidebar-components";
import { useToast } from '@/hooks/use-toast';
import type { PaymentConfiguration, Project, WithId } from '@/lib/definitions';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CreatePaymentConfigDialog } from '@/components/wabasimplify/create-payment-config-dialog';
import { RegenerateOauthDialog } from '@/components/wabasimplify/regenerate-oauth-dialog';
import { UpdateDataEndpointDialog } from '@/components/wabasimplify/update-data-endpoint-dialog';


function PageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    )
}

function InfoRow({ label, value }: { label: string, value: React.ReactNode }) {
    return (
        <div className="flex justify-between items-center text-sm py-2 border-b">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold text-right">{value}</span>
        </div>
    );
}

export default function WhatsAppPaySetupPage() {
    const [project, setProject] = useState<Project | null>(null);
    const [configs, setConfigs] = useState<PaymentConfiguration[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();
    const { toast } = useToast();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const fetchData = (showToast = false) => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startLoading(async () => {
                const projectData = await getProjectById(storedProjectId);
                setProject(projectData);
                if (projectData) {
                    const { configurations, error: fetchError } = await getPaymentConfigurations(storedProjectId);
                    if (fetchError) setError(fetchError);
                    else setConfigs(configurations);
                }
                if (showToast) {
                    toast({ title: "Refreshed", description: "Payment configurations have been updated from Meta." });
                }
            });
        } else {
            setError("No active project selected.");
        }
    };
    
    useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const commerceManagerUrl = `https://business.facebook.com/commerce/`;
    
    const getStatusVariant = (status: string) => {
        if (!status) return 'outline';
        const lowerStatus = status.toLowerCase();
        if (lowerStatus === 'active') return 'default';
        if (lowerStatus.includes('needs')) return 'secondary';
        return 'destructive';
    };

    if (isLoading && !project) {
        return <PageSkeleton />;
    }

    if (!project) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage its payment settings.</AlertDescription>
            </Alert>
        );
    }
    
    return (
        <>
        <CreatePaymentConfigDialog isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchData} />
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>WhatsApp Pay Setup</CardTitle>
                    <CardDescription>To enable WhatsApp Pay, you need to configure a payment provider (like Stripe or Razorpay) within your Meta Commerce Manager.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ol className="list-decimal list-inside space-y-2">
                        <li>Navigate to your Meta Commerce Manager.</li>
                        <li>Go to the **Settings** tab.</li>
                        <li>Select **Payment Method** and add your preferred payment provider.</li>
                        <li>Once configured, click "Refresh Configurations" below to see your setup.</li>
                    </ol>
                </CardContent>
                <CardFooter>
                    <Button asChild>
                        <a href={commerceManagerUrl} target="_blank" rel="noopener noreferrer">
                            Go to Commerce Manager
                            <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Your Payment Configurations</CardTitle>
                        <CardDescription>A list of payment providers linked to your WABA.</CardDescription>
                    </div>
                     <div className="flex items-center gap-2">
                        <Button onClick={() => fetchData(true)} variant="outline" size="sm" disabled={isLoading}>
                            {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                            Refresh
                        </Button>
                        <Button onClick={() => setIsCreateOpen(true)} size="sm">
                            <PlusCircle className="mr-2 h-4 w-4"/>
                            Create Configuration
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {error ? (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : configs.length > 0 ? (
                         <div className="grid md:grid-cols-2 gap-4">
                            {configs.map(config => (
                                <Card key={config.configuration_name}>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-base">
                                            <WaPayIcon className="h-5 w-5"/>
                                            {config.configuration_name}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <InfoRow label="Provider" value={<span className="capitalize">{config.provider_name}</span>} />
                                        <InfoRow label="Status" value={<Badge variant={getStatusVariant(config.status)}>{config.status}</Badge>} />
                                        <InfoRow label="Provider MID" value={<span className="font-mono text-xs">{config.provider_mid}</span>} />
                                    </CardContent>
                                    <CardFooter className="flex justify-end gap-2">
                                        <UpdateDataEndpointDialog project={project} config={config} onSuccess={fetchData} />
                                        {config.status === 'Needs_Connecting' && (
                                            <RegenerateOauthDialog project={project} config={config} onSuccess={fetchData} />
                                        )}
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No payment configurations found for this WABA.</p>
                    )}
                </CardContent>
            </Card>
        </div>
        </>
    );
}
