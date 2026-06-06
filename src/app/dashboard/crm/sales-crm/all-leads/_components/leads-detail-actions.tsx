'use client';

import { Button } from '@/components/sabcrm/20ui';
import {
  Activity,
  Archive,
  Building,
  Edit,
  LoaderCircle,
  Mail,
  MessageCircle,
  Phone,
  Printer,
  Trash2,
  } from 'lucide-react';

/**
 * Header action group for the lead detail page (extracted to keep
 * `[id]/page.tsx` under the 600-line scope cap).
 *
 * Eight clickable affordances plus a destructive delete — Edit ·
 * Convert · Email · WhatsApp · Call · Print · Archive · Activity ·
 * Delete. Buttons that depend on lead data (e.g. WhatsApp without a
 * phone) gracefully no-render rather than rendering disabled.
 */

import * as React from 'react';
import Link from 'next/link';

export interface LeadDetailActionsProps {
    leadId: string;
    email?: string | null;
    phone?: string | null;
    archived: boolean;
    converted: boolean;
    converting: boolean;
    onConvert: () => void;
    onComposeEmail: () => void;
    onArchive: () => void;
    onDelete: () => void;
}

export function LeadDetailActions({
    leadId,
    email,
    phone,
    archived,
    converted,
    converting,
    onConvert,
    onComposeEmail,
    onArchive,
    onDelete,
}: LeadDetailActionsProps) {
    const printHref = `/dashboard/crm/sales-crm/all-leads/${leadId}?print=1`;
    const whatsappHref = phone
        ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}`
        : null;
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/sales-crm/all-leads/${leadId}/edit`}>
                    <Edit className="h-3.5 w-3.5" /> Edit
                </Link>
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={onConvert}
                disabled={converting || converted}
            >
                {converting ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Building className="h-3.5 w-3.5" />
                )}
                Convert to Account
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={onComposeEmail}
                disabled={!email}
            >
                <Mail className="h-3.5 w-3.5" /> Email
            </Button>
            {whatsappHref ? (
                <Button asChild variant="outline" size="sm">
                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                </Button>
            ) : null}
            {phone ? (
                <Button asChild variant="outline" size="sm">
                    <a href={`tel:${phone}`}>
                        <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
                <a href={printHref} target="_blank" rel="noopener noreferrer">
                    <Printer className="h-3.5 w-3.5" /> Print
                </a>
            </Button>
            <Button variant="outline" size="sm" onClick={onArchive}>
                <Archive className="h-3.5 w-3.5" /> {archived ? 'Restore' : 'Archive'}
            </Button>
            <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/sales-crm/all-leads/${leadId}/activity`}>
                    <Activity className="h-3.5 w-3.5" /> Activity
                </Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
        </div>
    );
}

export default LeadDetailActions;
