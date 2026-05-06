'use client';

import { Clock } from 'lucide-react';
import {
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import { ShiftForm } from '../_components/shift-form';

export default function NewShiftPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
          <Clock className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <ZoruPageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>New Shift</ZoruPageTitle>
            <ZoruPageDescription>
              Create a shift with timings, break rules and open days.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>
      </div>
      <ShiftForm />
    </div>
  );
}
