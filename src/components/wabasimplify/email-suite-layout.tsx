'use client';

import { useState, useEffect } from 'react';
import { ModuleLayout } from '@/components/wabasimplify/module-layout';
import { ModuleSidebar } from '@/components/wabasimplify/module-sidebar';
import { Mail, Send, Users, FileText, Settings, Inbox, ChevronDown, PlusCircle, BarChart3 } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { WithId, EmailSettings } from '@/lib/definitions';
import { getEmailSettings } from '@/app/actions/email.actions';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface EmailSuiteLayoutProps {
    children: React.ReactNode;
}

export function EmailSuiteLayout({ children }: EmailSuiteLayoutProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const currentAccountId = searchParams.get('accountId');

    const [accounts, setAccounts] = useState<WithId<EmailSettings>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('inbox');

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            const data = await getEmailSettings();
            setAccounts(data);
            setIsLoading(false);

            // If no accounts, redirect to settings/onboarding
            if (data.length === 0) {
                // If we are already on settings page, don't loop
                if (!pathname.includes('/settings')) {
                    router.replace('/dashboard/email/settings?view=connect');
                }
                return;
            }
        };
        fetchSettings();
    }, [pathname, router]);

    // Sync active tab with pathname
    useEffect(() => {
        if (pathname === '/dashboard/email') setActiveTab('overview');
        else if (pathname.includes('/inbox')) setActiveTab('inbox');
        else if (pathname.includes('/campaigns')) setActiveTab('campaigns');
        else if (pathname.includes('/contacts')) setActiveTab('contacts');
        else if (pathname.includes('/templates')) setActiveTab('templates');
        else if (pathname.includes('/settings')) setActiveTab('settings');
    }, [pathname]);

    const handleAccountChange = (newAccountId: string) => {
        if (newAccountId === 'back_to_list') {
            router.push('/dashboard/email');
            return;
        }
        if (newAccountId === 'add_new') {
            router.push('/dashboard/email/settings?view=connect');
            return;
        }
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('accountId', newAccountId);
        router.push(`${pathname}?${newParams.toString()}`);
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        const newParams = new URLSearchParams(searchParams.toString());
        // Ensure accountId is preserved
        if (currentAccountId) newParams.set('accountId', currentAccountId);

        if (value === 'overview') router.push(`/dashboard/email?${newParams.toString()}`);
        if (value === 'inbox') router.push(`/dashboard/email/inbox?${newParams.toString()}`);
        if (value === 'campaigns') router.push(`/dashboard/email/campaigns?${newParams.toString()}`);
        if (value === 'contacts') router.push(`/dashboard/email/contacts?${newParams.toString()}`);
        if (value === 'templates') router.push(`/dashboard/email/templates?${newParams.toString()}`);
        if (value === 'settings') router.push(`/dashboard/email/settings?accountId=${currentAccountId}&tab=email`); // Settings handles its own params too
    };

    if (isLoading) {
        return (
            <div className="flex gap-8 h-full">
                <Skeleton className="w-64 h-full" />
                <div className="flex-1 space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    // If no accounts, we might want to redirect, but let the page handle it if it renders the connect view?
    // Actually, Layout should probably allow rendering children if no account selected, just without sidebar.

    const activeAccount = accounts.find(a => a._id.toString() === currentAccountId);

    if (!currentAccountId || !activeAccount) {
        return <div className="h-full p-4">{children}</div>;
    }

    return (
        <ModuleLayout
            sidebar={
                <div className="flex flex-col h-full gap-4">
                    <div className="px-2">
                        <Select value={activeAccount._id.toString()} onValueChange={handleAccountChange}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select Account" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[300px]">
                                <SelectItem value="back_to_list" className="font-medium text-muted-foreground mb-1">
                                    ← All Accounts
                                </SelectItem>

                                <div className="max-h-[200px] overflow-y-auto">
                                    {accounts.length === 0 ? (
                                        <div className="p-4 text-sm text-center text-muted-foreground">
                                            No connected accounts found.
                                        </div>
                                    ) : (
                                        accounts.map(acc => (
                                            <SelectItem key={acc._id.toString()} value={acc._id.toString()}>
                                                <div className="flex flex-col items-start text-left overflow-hidden">
                                                    <span className="font-semibold text-sm truncate w-full">{acc.fromName || 'Account'}</span>
                                                    <span className="text-xs text-muted-foreground truncate w-full">{acc.fromEmail}</span>
                                                </div>
                                            </SelectItem>
                                        ))
                                    )}
                                </div>
                                <div className="h-px bg-border my-1" />
                                <SelectItem value="add_new" className="text-primary focus:text-primary font-medium py-3">
                                    <div className="flex flex-col gap-1 items-start w-full">
                                        <div className="flex items-center gap-2 font-semibold">
                                            <PlusCircle className="h-4 w-4" /> Connect Your Email
                                        </div>
                                        <span className="text-xs text-muted-foreground whitespace-normal text-left leading-snug">
                                            Link your email account to sync conversations, send campaigns, and track deliverability directly from your dashboard.
                                        </span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <ModuleSidebar
                        title="" // Empty title as we have the selector above
                        activeValue={activeTab}
                        onValueChange={handleTabChange}
                        items={[
                            { value: 'overview', label: 'Overview', icon: BarChart3 },
                            { value: 'inbox', label: 'Inbox', icon: Inbox },
                            { value: 'campaigns', label: 'Campaigns', icon: Send },
                            { value: 'contacts', label: 'Contacts', icon: Users },
                            { value: 'templates', label: 'Templates', icon: FileText },
                            { value: 'settings', label: 'Settings', icon: Settings },
                        ]}
                    />
                </div>
            }
        >
            {children}
        </ModuleLayout>
    );
}
