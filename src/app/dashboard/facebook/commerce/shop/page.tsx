
'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { LayoutGrid, ExternalLink, Store, Link as LinkIcon, CreditCard, Palette, AlertCircle } from 'lucide-react';
import { getProjectById } from '@/app/actions';
import type { WithId, Project } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const SetupStepCard = ({ title, description, buttonText, href, icon: Icon }: { title: string, description: string, buttonText: string, href: string, icon: React.ElementType }) => (
    <Card className="flex flex-col card-gradient card-gradient-green">
        <CardHeader className="flex-row items-start gap-4 space-y-0">
            <div className="p-3 bg-primary/10 rounded-full">
                <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </div>
        </CardHeader>
        <CardFooter className="mt-auto">
            <Button asChild className="w-full">
                <a href={href} target="_blank" rel="noopener noreferrer">
                    {buttonText} <ExternalLink className="ml-2 h-4 w-4" />
                </a>
            </Button>
        </CardFooter>
    </Card>
);

export default function ShopSetupPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            startLoading(async () => {
                const projectData = await getProjectById(storedProjectId);
                setProject(projectData);
            });
        }
    }, []);

    const commerceManagerUrl = project?.businessId 
        ? `https://business.facebook.com/commerce/${project.businessId}/` 
        : 'https://business.facebook.com/commerce_manager/';

    if (isLoading) {
        return <Skeleton className="w-full h-96" />;
    }

    if (!project) {
        return (
             <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project to manage its shop settings.
                </AlertDescription>
            </Alert>
        );
    }
    
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><LayoutGrid /> Shop Setup</h1>
                <p className="text-muted-foreground">Configure and manage your Facebook Shop settings. Most of these actions must be completed in Meta's Commerce Manager.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <SetupStepCard 
                    icon={Store}
                    title="1. Create Your Shop"
                    description="If you don't have a shop yet, the first step is to create one in Commerce Manager. You'll choose where you want customers to check out."
                    buttonText="Go to Commerce Manager"
                    href={commerceManagerUrl}
                />
                 <SetupStepCard 
                    icon={LinkIcon}
                    title="2. Link Your Catalog"
                    description="Connect a product catalog to your shop to start displaying items. You can manage catalogs from our 'Products' page."
                    buttonText="Manage Catalogs"
                    href="/dashboard/facebook/commerce/products"
                />
                 <SetupStepCard 
                    icon={CreditCard}
                    title="3. Set Up Checkout"
                    description="Configure how customers will pay. Options include on Facebook/Instagram (US only) or by directing them to your website."
                    buttonText="Configure Payments"
                    href={commerceManagerUrl}
                />
                 <SetupStepCard 
                    icon={Palette}
                    title="4. Customize Your Shop"
                    description="Design the layout of your shopfront. Create collections and arrange them to create a unique customer experience."
                    buttonText="Customize Shop"
                    href={commerceManagerUrl}
                />
            </div>
        </div>
    )
}
