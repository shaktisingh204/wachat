import { Suspense } from 'react';
import { getShiftById } from '@/app/actions/crm-shifts.actions';
import { notFound } from 'next/navigation';
import { EditShiftClient } from './edit-shift-client';
import { LoaderCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';


export default async function EditShiftPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    return (
        <Suspense
            fallback={
                <div className="flex h-32 items-center justify-center">
                    <LoaderCircle className="h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                </div>
            }
        >
            <ShiftLoader id={id} />
        </Suspense>
    );
}

async function ShiftLoader({ id }: { id: string }) {
    // Explicit error boundary handling can be wrapped around the tree,
    // here we let Next.js Error boundaries handle it or handle it at component level.
    // However, user requested "explicit error boundaries defined for edit data fetching",
    // so we should create an error.tsx file.
    const shift = await getShiftById(id);
    if (!shift) {
        notFound();
    }
    return <EditShiftClient initial={shift} />;
}
