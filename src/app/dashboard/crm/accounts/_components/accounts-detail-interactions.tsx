'use client';

import { useToast } from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';

/**
 * Client island for the account detail page (§1D.2).
 *
 * Hosts the dialog-bearing interactivity that can't live in a Server
 * Component: the header action group, the archive/restore confirm, and
 * the bulk-email compose dialog. The server page passes in the
 * account's primitives + the email list so this island stays pure UI +
 * state.
 */

import * as React from 'react';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { ComposeEmailDialog } from '@/components/zoruui-domain/crm-compose-email-dialog';
import {
    archiveCrmAccount,
    unarchiveCrmAccount,
} from '@/app/actions/crm-accounts.actions';
import { enrichAccountData } from '../actions';

import { AccountDetailActions } from './accounts-detail-actions';

interface AccountDetailInteractionsProps {
    accountId: string;
    name: string;
    industry?: string;
    website?: string;
    phone?: string | null;
    country?: string;
    state?: string;
    city?: string;
    currency?: string;
    category?: string;
    archived: boolean;
    /** Comma-joined emails of the associated contacts, used to pre-fill compose. */
    contactEmails: string[];
}

export function AccountDetailInteractions({
    accountId,
    name,
    industry,
    website,
    phone,
    country,
    state,
    city,
    currency,
    category,
    archived,
    contactEmails,
}: AccountDetailInteractionsProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [composeOpen, setComposeOpen] = React.useState(false);
    const [archiveOpen, setArchiveOpen] = React.useState(false);

    const handleArchiveConfirm = React.useCallback(async () => {
        const res = archived
            ? await unarchiveCrmAccount(accountId)
            : await archiveCrmAccount(accountId);
        if (res.success) {
            toast({
                title: archived ? 'Account restored' : 'Account archived',
            });
            router.refresh();
        } else {
            toast({
                title: archived ? 'Restore failed' : 'Archive failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setArchiveOpen(false);
    }, [accountId, archived, router, toast]);

    const handleEnrich = React.useCallback(async () => {
        if (!website) return;
        const domain = website.replace(/^https?:\/\//, '').split('/')[0];
        toast({ title: 'Enriching account data...' });
        const res = await enrichAccountData(accountId, domain);
        if (res.success) {
            toast({ title: 'Account enriched successfully', variant: 'success' });
            router.refresh();
        } else {
            toast({ title: 'Enrichment failed', description: res.error, variant: 'destructive' });
        }
    }, [accountId, website, router, toast]);

    return (
        <>
            <AccountDetailActions
                accountId={accountId}
                name={name}
                industry={industry}
                website={website}
                phone={phone}
                country={country}
                state={state}
                city={city}
                currency={currency}
                category={category}
                archived={archived}
                onComposeEmail={() => setComposeOpen(true)}
                onArchive={() => setArchiveOpen(true)}
                onEnrich={handleEnrich}
            />

            <ComposeEmailDialog
                isOpen={composeOpen}
                onOpenChange={setComposeOpen}
                initialTo={contactEmails.join(', ')}
                initialSubject={`Regarding your account: ${name}`}
            />

            <ConfirmDialog
                open={archiveOpen}
                onOpenChange={setArchiveOpen}
                title={
                    archived ? 'Restore this account?' : 'Archive this account?'
                }
                description={
                    archived
                        ? `"${name}" will return to your active list.`
                        : `"${name}" will be hidden from default views. You can restore it later.`
                }
                confirmLabel={archived ? 'Restore' : 'Archive'}
                confirmTone="primary"
                onConfirm={handleArchiveConfirm}
            />
        </>
    );
}
