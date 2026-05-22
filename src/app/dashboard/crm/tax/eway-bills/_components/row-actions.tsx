'use client';

import { Button } from '@/components/zoruui';
import {
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Per-row e-way bill actions for the list page. Three buttons:
 *   - Cancel (active only)
 *   - Update vehicle (active only)
 *   - Extend validity (active only)
 *
 * Each opens a `window.prompt` shell — full dialog UX is left for a
 * follow-up; the shell ships working server actions today.
 */

import Link from 'next/link';

import {
    cancelEWayBill,
    extendEWayBillValidity,
    updateEWayBillVehicle,
} from '@/app/actions/crm-india-eway.actions';

export function EWayBillRowActions({ id, status }: { id: string; status: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const isActive = status === 'active';

    function withReason(prompt: string, run: (reason: string) => Promise<{ ok: boolean; error?: string }>) {
        const reason = typeof window !== 'undefined' ? window.prompt(prompt, '') : null;
        if (!reason || !reason.trim()) return;
        startTransition(async () => {
            const r = await run(reason.trim());
            if (!r.ok) {
                alert(r.error ?? 'Failed.');
                return;
            }
            router.refresh();
        });
    }

    function onCancel() {
        withReason('Cancel reason', (reason) => cancelEWayBill(id, reason));
    }
    function onUpdateVehicle() {
        const vehicle = typeof window !== 'undefined'
            ? window.prompt('New vehicle number (e.g. KA01AB1234):', '')
            : null;
        if (!vehicle || !vehicle.trim()) return;
        const reason = typeof window !== 'undefined'
            ? window.prompt('Reason for change:', 'Vehicle breakdown')
            : null;
        if (!reason || !reason.trim()) return;
        startTransition(async () => {
            const r = await updateEWayBillVehicle(id, vehicle.trim(), reason.trim());
            if (!r.ok) {
                alert(r.error ?? 'Failed.');
                return;
            }
            router.refresh();
        });
    }
    function onExtend() {
        const kmStr = typeof window !== 'undefined'
            ? window.prompt('Additional kilometres:', '100')
            : null;
        const km = Number(kmStr);
        if (!Number.isFinite(km) || km <= 0) return;
        const reason = typeof window !== 'undefined'
            ? window.prompt('Reason:', 'Additional distance required')
            : null;
        if (!reason || !reason.trim()) return;
        startTransition(async () => {
            const r = await extendEWayBillValidity(id, km, reason.trim());
            if (!r.ok) {
                alert(r.error ?? 'Failed.');
                return;
            }
            router.refresh();
        });
    }

    return (
        <div className="flex items-center justify-end gap-1">
            <ZoruButton asChild size="sm" variant="outline">
                <Link href={`/dashboard/crm/tax/eway-bills/${id}`}>View</Link>
            </ZoruButton>
            {isActive ? (
                <>
                    <ZoruButton size="sm" variant="outline" disabled={pending} onClick={onUpdateVehicle}>
                        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Update vehicle
                    </ZoruButton>
                    <ZoruButton size="sm" variant="outline" disabled={pending} onClick={onExtend}>
                        Extend
                    </ZoruButton>
                    <ZoruButton size="sm" variant="outline" disabled={pending} onClick={onCancel}>
                        Cancel
                    </ZoruButton>
                </>
            ) : null}
        </div>
    );
}
