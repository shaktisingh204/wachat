

'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Mail, Send, Users, FileText } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function EmailDashboardPage() {
    const features = [
        {
            title: "Campaigns",
            description: "Send beautiful, personalized emails to your audience.",
            href: "/dashboard/email/campaigns",
            icon: Send
        },
        {
            title: "Contacts",
            description: "Manage your subscribers, lists, and segments.",
            href: "/dashboard/email/contacts",
            icon: Users
        },
        {
            title: "Templates",
            description: "Create and manage reusable email templates.",
            href: "/dashboard/email/templates",
            icon: FileText
        }
    ];

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Mail /> Email Suite</h1>
                <p className="text-muted-foreground">Your central hub for email communications.</p>
            </div>
             <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {features.map(feature => (
                    <Card key={feature.href} className="flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <feature.icon className="h-5 w-5" />
                                {feature.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow">
                             <p className="text-muted-foreground">{feature.description}</p>
                        </CardContent>
                        <CardFooter>
                            <Button asChild className="w-full">
                                <Link href={feature.href}>Go to {feature.title}</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
            <Card className="text-center py-12">
                <CardHeader>
                    <CardTitle>Unified Inbox Coming Soon!</CardTitle>
                </CardHeader>
                 <CardContent>
                    <p className="text-muted-foreground">The unified inbox to view and manage all your synced emails is under development.</p>
                </CardContent>
            </Card>
        </div>
    );
}
