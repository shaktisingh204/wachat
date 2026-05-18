'use client';

import { ZoruButton, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Archive as ArchiveIcon,
  Check,
  FileText,
  History,
  Mail,
  Pencil,
  } from 'lucide-react';

/**
 * <PayslipActions> — client island for lifecycle buttons on the payslip
 * detail page. Wraps `archivePayslipAction` / `acknowledgePayslipAction`
 * with a toast + router refresh so the detail page updates in-place.
 *
 * `Print` and `Email` are intent stubs — the Rust crate doesn't expose
 * those endpoints today; the buttons are present so the action group
 * matches the §1B spec.
 */

import * as React from 'react';

import {
    acknowledgePayslipAction,
    archivePayslipAction,
} from '@/app/actions/crm-payslips.actions';

interface PayslipActionsProps {
    id: string;
    /** True when the payslip is already in an archived state. */
    archived?: boolean;
    /** True when the payslip is already in a `paid` (acknowledged) state. */
    acknowledged?: boolean;
}

export function PayslipActions({ id, archived, acknowledged }: PayslipActionsProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [pendingKey, setPendingKey] = React.useState<string | null>(null);

    const wrap = React.useCallback(
        async (
            key: string,
            label: string,
            fn: () => Promise<{ success: boolean; error?: string }>,
        ) => {
            setPendingKey(key);
            try {
                const res = await fn();
                if (!res.success) {
                    toast({
                        title: 'Action failed',
                        description: res.error ?? `Could not ${label}.`,
                        variant: 'destructive',
                    });
                    return;
                }
                toast({ title: `${label} succeeded.` });
                router.refresh();
            } finally {
                setPendingKey(null);
            }
        },
        [router, toast],
    );

    return (
        <>
            <ZoruButton variant="outline" size="sm" asChild>
                <Link href={`/dashboard/crm/hr-payroll/payslips/${id}/edit`}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                </Link>
            </ZoruButton>
            <ZoruButton
                variant="outline"
                size="sm"
                disabled
                title="PDF export pending"
            >
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Print
            </ZoruButton>
            <ZoruButton
                variant="outline"
                size="sm"
                disabled
                title="Email delivery pending"
            >
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                Email
            </ZoruButton>
            <ZoruButton
                variant="outline"
                size="sm"
                disabled={acknowledged || pendingKey !== null}
                onClick={() =>
                    wrap('acknowledge', 'Acknowledge', () =>
                        acknowledgePayslipAction(id),
                    )
                }
            >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                {acknowledged ? 'Acknowledged' : 'Acknowledge'}
            </ZoruButton>
            <ZoruButton
                variant="outline"
                size="sm"
                disabled={archived || pendingKey !== null}
                onClick={() =>
                    wrap('archive', 'Archive', () => archivePayslipAction(id))
                }
            >
                <ArchiveIcon className="mr-1.5 h-3.5 w-3.5" />
                {archived ? 'Archived' : 'Archive'}
            </ZoruButton>
            <ZoruButton variant="ghost" size="sm" asChild>
                <Link href={`/dashboard/crm/hr-payroll/payslips/${id}/edit`}>
                    <History className="mr-1.5 h-3.5 w-3.5" />
                    Activity
                </Link>
            </ZoruButton>
        </>
    );
}
