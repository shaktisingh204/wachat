import { ZoruButton, ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';
import {
  ArrowLeft,
  Truck } from 'lucide-react';

/**
 * Generate-new e-way bill — `/dashboard/crm/tax/eway-bills/new`.
 *
 * Thin shell: a form that posts to the `generateEWayBill` server action.
 * Invoice lookup is left as a string id for now — the picker can be
 * wired up in a follow-up using the existing entity-picker.
 */

import Link from 'next/link';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { NewEWayBillForm } from './_components/new-form';

export const dynamic = 'force-dynamic';

export default function NewEWayBillPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Generate e-way bill"
                subtitle="Required for inter/intra-state goods movement above ₹50,000."
                icon={Truck}
                actions={
                    <ZoruButton asChild variant="outline">
                        <Link href="/dashboard/crm/tax/eway-bills">
                            <ArrowLeft className="h-4 w-4" />
                            Back to list
                        </Link>
                    </ZoruButton>
                }
            />
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Consignment details</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <NewEWayBillForm />
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
