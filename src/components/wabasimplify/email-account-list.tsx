'use client';

import { ZoruCard, ZoruCardHeader, ZoruCardTitle, ZoruCardDescription, ZoruCardFooter, ZoruButton } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruBadge } from '@/components/zoruui';
import { CheckCircle, Plus, Mail } from 'lucide-react';
import { GoogleIcon, OutlookIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { useRouter } from 'next/navigation';
import type { WithId, EmailSettings } from '@/lib/definitions';

interface EmailAccountListProps {
    accounts: WithId<EmailSettings>[];
}

export function EmailAccountList({ accounts }: EmailAccountListProps) {
    const router = useRouter();

    return (
        <div className="space-y-8 max-w-5xl mx-auto py-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Mail className="h-8 w-8" /> Email Suite</h1>
                    <p className="text-muted-foreground mt-2">ZoruSelect an account to manage.</p>
                </div>
                <ZoruButton onClick={() => router.push('/dashboard/email/settings?view=connect')}>
                    <Plus className="mr-2 h-4 w-4" /> Connect New Account
                </ZoruButton>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accounts.map((account) => {
                    const Icon = account.provider === 'google' ? GoogleIcon : account.provider === 'outlook' ? OutlookIcon : Mail;
                    return (
                        <ZoruCard
                            key={account._id.toString()}
                            className="group hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden"
                            onClick={() => router.push(`/dashboard/email?accountId=${account._id.toString()}`)}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <ZoruCardHeader>
                                <div className="flex justify-between items-start">
                                    <div className="p-3 bg-muted rounded-full group-hover:bg-primary/10 transition-colors z-10">
                                        <Icon className="h-6 w-6 text-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <ZoruBadge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 z-10"><CheckCircle className="h-3 w-3 mr-1" /> Active</ZoruBadge>
                                </div>
                                <ZoruCardTitle className="pt-4 truncate z-10 relative">{account.fromName || 'Unnamed Account'}</ZoruCardTitle>
                                <ZoruCardDescription className="truncate z-10 relative">{account.fromEmail}</ZoruCardDescription>
                            </ZoruCardHeader>
                            <ZoruCardFooter className="z-10 relative">
                                <ZoruButton variant="outline" className="w-full group-hover:bg-background">Go to Dashboard</ZoruButton>
                            </ZoruCardFooter>
                        </ZoruCard>
                    )
                })}
            </div>
        </div>
    );
}
