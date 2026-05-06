'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Clock } from 'lucide-react';
import {
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import { ShiftForm } from '../../_components/shift-form';
import { getEmployeeShift } from '@/app/actions/worksuite/shifts.actions';
import type { WsEmployeeShift } from '@/lib/worksuite/shifts-types';

export default function EditShiftPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [shift, setShift] = useState<WsEmployeeShift | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const data = await getEmployeeShift(id);
      setShift(data);
      setLoaded(true);
    })();
  }, [id]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink">
          <Clock className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <ZoruPageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>Edit Shift</ZoruPageTitle>
            <ZoruPageDescription>
              Adjust timings, break rules or open days.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>
      </div>
      {!loaded ? (
        <div className="text-[13px] text-zoru-ink-muted">Loading…</div>
      ) : shift ? (
        <ShiftForm initial={shift} />
      ) : (
        <div className="text-[13px] text-zoru-danger-ink">Shift not found.</div>
      )}
    </div>
  );
}
