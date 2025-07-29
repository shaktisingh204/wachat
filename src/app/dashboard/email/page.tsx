
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Mail, Send, Users, FileText, PlusCircle, Settings, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getEmailSettings } from '@/app/actions/email.actions';
import type { WithId, EmailSettings } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { GoogleIcon, OutlookIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { useRouter } from 'next/navigation';
import { Separator } from '@/components/ui/separator';

function PageSkeleton() {
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
            </div>
            <Skeleton className="h-4 w-96" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
                <Skeleton className="h-48" />
            </div>
        </div>
    );
}

function ConnectedAccountCard({ account }: { account: WithId<EmailSettings> }) {
    const router = useRouter();
    const Icon = account.provider === 'google' ? GoogleIcon : account.provider === 'outlook' ? OutlookIcon : Mail;
    
    const handleSelectAccount = () => {
        // In a multi-account setup, you'd set this as the active account
        // For now, we'll just navigate to the inbox
        router.push('/dashboard/email/inbox');
    }

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-start">
                     <div className="p-3 bg-muted rounded-full">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" /> Connected</Badge>
                </div>
                 <CardTitle className="pt-2">{account.fromName || 'Account'}</CardTitle>
                <CardDescription>{account.fromEmail}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">Provider: <span className="capitalize font-medium text-foreground">{account.provider}</span></p>
            </CardContent>
            <CardFooter>
                 <Button className="w-full" onClick={handleSelectAccount}>Go to Inbox</Button>
            </CardFooter>
        </Card>
    )
}

export default function EmailDashboardPage() {
    const [accounts, setAccounts] = useState<WithId<EmailSettings>[]>([]);
    const [isLoading, startLoading] = useTransition();

    useEffect(() => {
        startLoading(async () => {
            const settingsData = await getEmailSettings();
            setAccounts(settingsData);
        });
    }, []);

    if (isLoading) {
        return <PageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Mail /> Email Suite</h1>
                    <p className="text-muted-foreground">Your central hub for email communications.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/email/settings">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Connect New Account
                    </Link>
                </Button>
            </div>
            
            {accounts.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {accounts.map(acc => (
                        <ConnectedAccountCard key={acc._id.toString()} account={acc} />
                    ))}
                </div>
            ) : (
                <Card className="text-center py-20">
                    <CardHeader>
                        <CardTitle>Welcome to the Email Suite!</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground mb-4">You haven't connected an email account yet. Get started by setting one up.</p>
                        <Button asChild>
                            <Link href="/dashboard/email/settings">
                                <Settings className="mr-2 h-4 w-4" />
                                Go to Email Setup
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Separator />
            
             <h2 className="text-2xl font-semibold">Tools</h2>
             <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { title: "Campaigns", description: "Send bulk emails.", href: "/dashboard/email/campaigns", icon: Send },
                    { title: "Contacts", description: "Manage subscribers.", href: "/dashboard/email/contacts", icon: Users },
                    { title: "Templates", description: "Create reusable emails.", href: "/dashboard/email/templates", icon: FileText }
                ].map(feature => (
                    <Card key={feature.href} className="flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <feature.icon className="h-5 w-5" />
                                {feature.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow">
                             <p className="text-muted-foreground text-sm">{feature.description}</p>
                        </CardContent>
                        <CardFooter>
                            <Button asChild className="w-full" variant="outline">
                                <Link href={feature.href}>Go to {feature.title}</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
