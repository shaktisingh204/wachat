'use client';

import { Button } from '@/components/zoruui';
import {
  Activity,
  Archive,
  Copy,
  Edit,
  Handshake,
  Mail,
  Phone,
  Printer,
  UserPlus,
  } from 'lucide-react';

/**
 * Header action group for the account detail page (§1D.2).
 *
 * 9 clickable affordances — Edit · Add contact · Add deal · Email ·
 * Phone · Print · Duplicate · Archive · Activity. The button that
 * depends on contact data (e.g. Phone without a phone number) renders
 * disabled rather than disappearing so the action surface is stable.
 */

import * as React from 'react';
import Link from 'next/link';

export interface AccountDetailActionsProps {
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
    onComposeEmail: () => void;
    onArchive: () => void;
}

export function AccountDetailActions({
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
    onComposeEmail,
    onArchive,
}: AccountDetailActionsProps) {
    const printHref = `/dashboard/crm/accounts/${accountId}?print=1`;
    const duplicateHref =
        `/dashboard/crm/accounts/new?` +
        new URLSearchParams(
            Object.entries({
                name: `${name} (copy)`,
                industry,
                website,
                phone: phone ?? undefined,
                country,
                state,
                city,
                currency,
                category,
            }).filter(([, v]) => !!v) as [string, string][],
        ).toString();
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/accounts/${accountId}/edit`}>
                    <Edit className="h-3.5 w-3.5" /> Edit
                </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
                <Link
                    href={`/dashboard/crm/sales-crm/contacts/new?accountId=${accountId}`}
                >
                    <UserPlus className="h-3.5 w-3.5" /> Add contact
                </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
                <Link
                    href={`/dashboard/crm/sales-crm/deals/new?accountId=${accountId}`}
                >
                    <Handshake className="h-3.5 w-3.5" /> Add deal
                </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={onComposeEmail}>
                <Mail className="h-3.5 w-3.5" /> Email
            </Button>
            <Button
                asChild={!!phone}
                variant="outline"
                size="sm"
                disabled={!phone}
            >
                {phone ? (
                    <a href={`tel:${phone}`}>
                        <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                ) : (
                    <span>
                        <Phone className="h-3.5 w-3.5" /> Call
                    </span>
                )}
            </Button>
            <Button asChild variant="outline" size="sm">
                <a href={printHref} target="_blank" rel="noopener noreferrer">
                    <Printer className="h-3.5 w-3.5" /> Print
                </a>
            </Button>
            <Button asChild variant="outline" size="sm">
                <Link href={duplicateHref}>
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={onArchive}>
                <Archive className="h-3.5 w-3.5" />{' '}
                {archived ? 'Restore' : 'Archive'}
            </Button>
            <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/accounts/${accountId}/activity`}>
                    <Activity className="h-3.5 w-3.5" /> Activity
                </Link>
            </Button>
        </div>
    );
}

export default AccountDetailActions;
