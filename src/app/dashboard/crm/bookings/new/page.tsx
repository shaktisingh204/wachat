'use client';

export const dynamic = 'force-dynamic';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, Save, LoaderCircle, CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { saveBooking } from '@/app/actions/crm-bookings.actions';

const initialState = { message: '', error: '' };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      Save Booking
    </ZoruButton>
  );
}

export default function NewBookingPage() {
  const [state, formAction] = useActionState(saveBooking, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      router.push('/dashboard/crm/bookings');
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, router, toast]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Booking"
        subtitle="Reserve a resource, room, or staff slot for a customer."
        icon={CalendarClock}
        actions={
          <Link href="/dashboard/crm/bookings">
            <ZoruButton variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back to Bookings
            </ZoruButton>
          </Link>
        }
      />

      <ZoruCard className="p-6">
        <form action={formAction} className="space-y-6">
          {/* Resource + Service */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="resourceName" className="text-zoru-ink">
                Resource / Staff <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                id="resourceName"
                name="resourceName"
                placeholder="e.g. Conference Room A, Dr. Sharma"
                required
              />
            </div>

            <div className="space-y-1.5">
              <ZoruLabel htmlFor="serviceName" className="text-zoru-ink">
                Service
              </ZoruLabel>
              <ZoruInput
                id="serviceName"
                name="serviceName"
                placeholder="e.g. Consultation, Haircut, Meeting"
              />
            </div>
          </div>

          {/* Customer Name + Email */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="customerName" className="text-zoru-ink">
                Customer Name <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                id="customerName"
                name="customerName"
                placeholder="Full name"
                required
              />
            </div>

            <div className="space-y-1.5">
              <ZoruLabel htmlFor="customerEmail" className="text-zoru-ink">
                Customer Email
              </ZoruLabel>
              <ZoruInput
                id="customerEmail"
                name="customerEmail"
                type="email"
                placeholder="customer@example.com"
              />
            </div>
          </div>

          {/* Customer Phone */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="customerPhone" className="text-zoru-ink">
                Customer Phone
              </ZoruLabel>
              <ZoruInput
                id="customerPhone"
                name="customerPhone"
                type="tel"
                placeholder="+91 98765 43210"
              />
            </div>
          </div>

          {/* Slot Start + Slot End */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="slotStart" className="text-zoru-ink">
                Slot Start <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                id="slotStart"
                name="slotStart"
                type="datetime-local"
                required
              />
            </div>

            <div className="space-y-1.5">
              <ZoruLabel htmlFor="slotEnd" className="text-zoru-ink">
                Slot End <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                id="slotEnd"
                name="slotEnd"
                type="datetime-local"
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="notes" className="text-zoru-ink">
              Notes
            </ZoruLabel>
            <ZoruTextarea
              id="notes"
              name="notes"
              placeholder="Any special instructions or remarks…"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <SaveButton />
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
