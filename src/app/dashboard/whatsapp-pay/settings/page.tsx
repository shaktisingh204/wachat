
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getPaymentConfigurations } from '@/app/actions/whatsapp.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ExternalLink, RefreshCw, LoaderCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WaPayIcon } from "@/components/wabasimplify/custom-sidebar-components";
import { useToast } from '@/hooks/use-toast';
import type { PaymentConfiguration } from '@/lib/definitions';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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
        <div className="flex justify-between items-start text-sm py-2 border-b">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right">{value}</span>
        </div>
    );
}


export default function WhatsAppPaySetupPage() {
    const [configs, setConfigs] = useState<PaymentConfiguration[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useToast();

    const fetchData = () => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startTransition(async () => {
                const { configurations, error: fetchError } = await getPaymentConfigurations(storedProjectId);
                if (fetchError) setError(fetchError);
                else setConfigs(configurations);
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

    if (isLoading) {
        return <PageSkeleton />;
    }

    return (
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
                     <Button onClick={() => fetchData()} variant="outline" size="sm" disabled={isLoading}>
                        {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                        Refresh
                    </Button>
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
                                        <InfoRow label="Provider" value={config.provider_name} />
                                        <InfoRow label="Status" value={<Badge variant={config.status === 'Active' ? 'default' : 'secondary'}>{config.status}</Badge>} />
                                        <InfoRow label="Provider MID" value={<span className="font-mono text-xs">{config.provider_mid}</span>} />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">No payment configurations found for this WABA.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
