
import { Suspense } from 'react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Sliders, Mail, FileText } from 'lucide-react';
import { getCrmSettings } from '@/app/actions/crm-settings.actions';
import { getEmailSettings } from '@/app/actions/email.actions';
import { CrmSettingsForm } from '@/components/crm/settings/crm-settings-form';
import { CrmSmtpForm } from '@/components/wabasimplify/crm-smtp-form';
import { EmailTemplatesManager } from "@/components/wabasimplify/crm-email-templates-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { GoogleIcon, OutlookIcon } from '@/components/wabasimplify/custom-sidebar-components';

export const dynamic = 'force-dynamic';

export default async function CrmSettingsPage({ searchParams }: { searchParams?: Promise<{ tab?: string }> }) {
    const params = await searchParams;
    const activeTab = params?.tab || 'preferences';

    const [crmSettings, emailSettings] = await Promise.all([
        getCrmSettings(),
        getEmailSettings().then(res => res[0])
    ]);

    if (!crmSettings) return <div>Failed to load settings.</div>;

    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Settings className="h-8 w-8 text-primary" /> CRM Settings</h1>
                <p className="text-muted-foreground mt-2">Manage your organization profile, sales preferences, inventory configurations, and integrations.</p>
            </div>

            <Tabs defaultValue={activeTab} className="w-full">
                <TabsList className="grid w-full max-w-2xl grid-cols-3">
                    <TabsTrigger value="preferences" className="gap-2"><Sliders className="h-4 w-4" /> Preferences</TabsTrigger>
                    <TabsTrigger value="email" className="gap-2"><Mail className="h-4 w-4" /> Email & SMTP</TabsTrigger>
                    <TabsTrigger value="templates" className="gap-2"><FileText className="h-4 w-4" /> Templates</TabsTrigger>
                </TabsList>

                <TabsContent value="preferences" className="mt-6">
                    <CrmSettingsForm settings={crmSettings} />
                </TabsContent>

                <TabsContent value="email" className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">Connect Email Account</CardTitle>
                            <CardDescription>Sync emails directly from your provider (Gmail/Outlook) or configure custom SMTP.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-4">
                                <Button asChild variant="outline" className="h-12 border-2">
                                    <Link href="/api/crm/auth/google/connect">
                                        <GoogleIcon className="mr-2 h-5 w-5" /> Connect Gmail
                                    </Link>
                                </Button>
                                <Button asChild variant="outline" className="h-12 border-2">
                                    <Link href="/api/crm/auth/outlook/connect">
                                        <OutlookIcon className="mr-2 h-5 w-5" /> Connect Outlook
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                    <Separator />
                    <CrmSmtpForm settings={emailSettings} />
                </TabsContent>

                <TabsContent value="templates" className="mt-6">
                    <EmailTemplatesManager />
                </TabsContent>
            </Tabs>
        </div>
    );
}
