'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Clock } from 'lucide-react';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
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
      <CrmPageHeader
        title="Edit Shift"
        subtitle="Adjust timings, break rules or open days."
        icon={Clock}
      />
      {!loaded ? (
        <div className="text-[13px] text-clay-ink-muted">Loading…</div>
      ) : shift ? (
        <ShiftForm initial={shift} />
      ) : (
        <div className="text-[13px] text-clay-red">Shift not found.</div>
      )}
    </div>
  );
}
