

'use client';

import { useEffect, useState, useTransition } from 'react';
import { getPaymentConfigurations, getPaymentConfigurationByName, handleDeletePaymentConfiguration } from '@/app/actions/whatsapp.actions';
import { getProjectById } from '@/app/actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ExternalLink, RefreshCw, LoaderCircle, CheckCircle, Eye, PlusCircle, Settings, Link as LinkIcon, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WaPayIcon } from "@/components/wabasimplify/custom-sidebar-components";
import { useToast } from '@/hooks/use-toast';
import type { PaymentConfiguration, Project } from '@/lib/definitions';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription
} from '@/components/ui/dialog';
import { CreatePaymentConfigDialog } from '@/components/wabasimplify/create-payment-config-dialog';
import { UpdateDataEndpointDialog } from '@/components/wabasimplify/update-data-endpoint-dialog';
import { RegenerateOauthDialog } from '@/components/wabasimplify/regenerate-oauth-dialog';

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
    const [selectedConfig, setSelectedConfig] = useState<PaymentConfiguration | null>(null);
    const [isDetailsLoading, startDetailsLoading] = useTransition();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const fetchData = () => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startLoading(async () => {
                const projectData = await getProjectById(storedProjectId);
                setProject(projectData);
                if (projectData) {
                    const { configurations, error: fetchError } = await getPaymentConfigurations(projectData._id.toString());
                    if (fetchError) setError(fetchError);
                    else setConfigs(configurations);
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

    const viewDetails = (config: PaymentConfiguration) => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (!storedProjectId) return;
        
        startDetailsLoading(async () => {
            const result = await getPaymentConfigurationByName(storedProjectId, config.configuration_name);
            if(result.error) {
                 toast({ title: 'Error', description: `Could not fetch details: ${result.error}`, variant: 'destructive' });
            } else {
                setSelectedConfig(result.configuration || null);
            }
        });
    }

    const handleDelete = async (configName: string) => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (!storedProjectId) return;
        
        const result = await handleDeletePaymentConfiguration(storedProjectId, configName);
        if (result.success) {
            toast({ title: "Success", description: "Payment configuration deleted." });
            fetchData();
        } else {
            toast({ title: "Error", description: result.error, variant: 'destructive' });
        }
    };


    const commerceManagerUrl = `https://business.facebook.com/commerce/`;

    if (isLoading) {
        return <PageSkeleton />;
    }

    return (
        <>
        {project && <CreatePaymentConfigDialog isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={fetchData}/>}
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
                    <div className="flex gap-2">
                        <Button onClick={() => fetchData()} variant="outline" size="sm" disabled={isLoading}>
                            {isLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                            Refresh
                        </Button>
                         <Button onClick={() => setIsCreateOpen(true)} size="sm">
                            <PlusCircle className="mr-2 h-4 w-4"/>
                            Create
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
                                        <CardTitle className="flex items-center justify-between text-base">
                                            <div className="flex items-center gap-2">
                                                <WaPayIcon className="h-5 w-5"/>
                                                {config.configuration_name}
                                            </div>
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete Configuration?</AlertDialogTitle>
                                                        <AlertDialogDescription>Are you sure you want to delete the "{config.configuration_name}" configuration?</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(config.configuration_name)}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <InfoRow label="Provider" value={config.provider_name} />
                                        <InfoRow label="Status" value={<Badge variant={config.status === 'Active' ? 'default' : 'secondary'}>{config.status}</Badge>} />
                                        <InfoRow label="Provider MID" value={<span className="font-mono text-xs">{config.provider_mid}</span>} />
                                    </CardContent>
                                    <CardFooter className="flex justify-end gap-2">
                                        {project && config.provider_name !== 'upi_vpa' && <RegenerateOauthDialog project={project} config={config} />}
                                        {project && <UpdateDataEndpointDialog project={project} config={config} onSuccess={fetchData} />}
                                        <Button variant="outline" size="sm" onClick={() => viewDetails(config)}>
                                            <Eye className="mr-2 h-4 w-4"/>
                                            View Details
                                        </Button>
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
        
        <Dialog open={!!selectedConfig} onOpenChange={(open) => !open && setSelectedConfig(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{selectedConfig?.configuration_name}</DialogTitle>
                    <DialogDescription>Full details for this payment configuration.</DialogDescription>
                </DialogHeader>
                {isDetailsLoading ? <LoaderCircle className="mx-auto h-8 w-8 animate-spin my-8"/> : selectedConfig ? (
                    <div className="space-y-2 text-sm">
                        <InfoRow label="Provider" value={selectedConfig.provider_name} />
                        <InfoRow label="Status" value={<Badge variant={selectedConfig.status === 'Active' ? 'default' : 'secondary'}>{selectedConfig.status}</Badge>} />
                        <InfoRow label="Provider MID" value={selectedConfig.provider_mid} />
                        <InfoRow label="MCC Code" value={`${selectedConfig.merchant_category_code?.code} (${selectedConfig.merchant_category_code?.description})`} />
                        <InfoRow label="Purpose Code" value={`${selectedConfig.purpose_code?.code} (${selectedConfig.purpose_code?.description})`} />
                        <InfoRow label="Created" value={new Date(selectedConfig.created_timestamp * 1000).toLocaleString()} />
                        <InfoRow label="Last Updated" value={new Date(selectedConfig.updated_timestamp * 1000).toLocaleString()} />
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
        </>
    );
}

    
