
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Settings, Mail, Bot, Handshake } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function CrmSettingsPage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Settings /> CRM Settings</h1>
                <p className="text-muted-foreground">Configure your CRM pipelines, automation, and integrations.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5"/>Email Integration</CardTitle>
                    <CardDescription>Connect your email accounts to sync conversations and send emails from within the CRM.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <p className="text-sm text-muted-foreground">Connect your email provider to get started.</p>
                     <div className="flex flex-wrap gap-4">
                        <Button variant="outline" disabled>Connect Gmail</Button>
                        <Button variant="outline" disabled>Connect Outlook</Button>
                        <Button variant="outline" disabled>Connect via IMAP</Button>
                     </div>
                </CardContent>
            </Card>

            <Separator />
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Handshake className="h-5 w-5"/>Pipeline & Stages</CardTitle>
                    <CardDescription>Customize the stages in your deal pipeline.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Pipeline customization is coming soon.</p>
                </CardContent>
                 <CardFooter>
                    <Button disabled>Manage Stages</Button>
                </CardFooter>
            </Card>

            <Separator />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5"/>Lead Automation</CardTitle>
                    <CardDescription>Set up rules for lead assignment and scoring.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Lead automation rules are coming soon.</p>
                </CardContent>
                <CardFooter>
                    <Button disabled>Create New Rule</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
