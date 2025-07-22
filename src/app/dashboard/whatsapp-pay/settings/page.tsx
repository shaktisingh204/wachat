
'use client';

import { useEffect, useState, useTransition } from 'react';
import { getProjectById } from '@/app/actions';
import type { WithId, Project } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WaPayIcon } from '@/components/wabasimplify/custom-sidebar-components';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
        </div>
    )
}

export default function WhatsAppPaySetupPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoadingTransition] = useTransition();

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startLoadingTransition(async () => {
                const projectData = await getProjectById(storedProjectId);
                setProject(projectData);
            });
        } else {
            startLoadingTransition(async () => {});
        }
    }, []);

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!project) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard to configure integrations.
                </AlertDescription>
            </Alert>
        );
    }
    
    const commerceManagerUrl = project?.businessId ? `https://business.facebook.com/commerce/${project.businessId}/` : 'https://business.facebook.com/commerce_manager/';


    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><WaPayIcon className="h-6 w-6"/>WhatsApp Pay Setup</CardTitle>
                <CardDescription>To enable WhatsApp Pay, you need to configure a payment provider (like Stripe or Razorpay) within your Meta Commerce Manager.</CardDescription>
            </CardHeader>
            <CardContent>
                <ol className="list-decimal list-inside space-y-2">
                    <li>Navigate to your Meta Commerce Manager.</li>
                    <li>Go to the **Settings** tab.</li>
                    <li>Select **Payment Method** and add your preferred payment provider.</li>
                    <li>Once configured, Meta will send a webhook to our server, and your payment status will update here automatically.</li>
                </ol>
                 <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-semibold">Current Payment Status</h4>
                     <p className="text-sm text-muted-foreground">
                        {project.paymentConfiguration ? `Status: ${project.paymentConfiguration.status}` : 'No payment configuration received from Meta.'}
                    </p>
                </div>
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
    );
}
