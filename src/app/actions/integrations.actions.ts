

'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import { getErrorMessage } from '@/lib/utils';
import Razorpay from 'razorpay';
import type { Project } from '@/lib/definitions';

export async function saveRazorpaySettings(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { error: 'Project ID is missing.' };
    
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: 'Access denied or project not found.' };

    try {
        const settings = {
            keyId: formData.get('keyId') as string,
            keySecret: formData.get('keySecret') as string,
        };

        if (!settings.keyId || !settings.keySecret) {
            return { error: 'Both Key ID and Key Secret are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { razorpaySettings: settings } }
        );

        revalidatePath('/dashboard/integrations');
        return { message: 'Razorpay settings saved successfully!' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function createRazorpayPaymentLink(
    project: WithId<Project>,
    amount: number,
    description: string,
    contact: { waId: string, name: string, email?: string }
): Promise<{ short_url: string, id: string } | { error: string }> {
    const settings = project.razorpaySettings;
    if (!settings?.keyId || !settings?.keySecret) {
        return { error: 'Razorpay is not configured for this project.' };
    }
    
    if(amount < 1) {
        return { error: 'Payment amount must be at least ₹1.' };
    }

    try {
        const instance = new Razorpay({
            key_id: settings.keyId,
            key_secret: settings.keySecret,
        });

        const options = {
            amount: amount * 100, // amount in the smallest currency unit
            currency: "INR",
            accept_partial: false,
            description,
            customer: {
                name: contact.name,
                contact: contact.waId.substring(contact.waId.length - 10), // Assuming Indian numbers
                ...(contact.email && { email: contact.email })
            },
            notify: {
                sms: true,
                email: !!contact.email
            },
            reminder_enable: true,
            callback_url: "https://sabnode.com/payment-success",
            callback_method: "get" as "get"
        };

        const paymentLink = await instance.paymentLink.create(options);
        return { short_url: paymentLink.short_url, id: paymentLink.id };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

```
  </change>
  <change>
    <file>/src/app/dashboard/integrations/page.tsx</file>
    <content><![CDATA[

'use client';

import { useEffect, useState, useTransition } from 'react';
import { getProjectById } from '@/app/actions';
import type { WithId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, AlertCircle } from 'lucide-react';
import { WhatsappLinkGenerator } from '@/components/wabasimplify/whatsapp-link-generator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { WhatsAppWidgetGenerator } from '@/components/wabasimplify/whatsapp-widget-generator';
import { RazorpaySettingsForm } from '@/components/wabasimplify/razorpay-settings-form';


function IntegrationsPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-80 w-full" />
        </div>
    )
}

export default function IntegrationsPage() {
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
            startLoadingTransition(async () => {}); // To ensure loading state is handled
        }
    }, []);

    if (isLoading) {
        return <IntegrationsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Zap className="h-8 w-8" />
                    Integrations
                </h1>
                <p className="text-muted-foreground mt-2">
                    Connect SabNode with your favorite tools and services.
                </p>
            </div>
            
            {project ? (
                <>
                    <WhatsappLinkGenerator project={project} />
                    <Separator />
                    <WhatsAppWidgetGenerator project={project} />
                    <Separator />
                    <RazorpaySettingsForm project={project} />
                </>
            ) : (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard to use integrations.
                    </AlertDescription>
                </Alert>
            )}

             <Card className="text-center py-20">
                <CardHeader>
                    <CardTitle>More Integrations Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">Integrations with platforms like Shopify, Zapier, and more are on the way.</p>
                </CardContent>
            </Card>
        </div>
    );
}

