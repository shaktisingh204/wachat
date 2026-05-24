import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getShiftById } from '@/app/actions/crm-shifts.actions';
import { ShiftDetailView } from './_components/shift-detail-view';
import { LoaderCircle } from 'lucide-react';

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shift = await getShiftById(id);

  if (!shift) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Suspense fallback={<div className="flex h-32 items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin text-zoru-ink-muted" /></div>}>
        <ShiftDetailView initialShift={shift} />
      </Suspense>
    </div>
  );
}
