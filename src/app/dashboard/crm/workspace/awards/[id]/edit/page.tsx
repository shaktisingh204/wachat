import { notFound } from 'next/navigation';

import { getAwardById } from '@/app/actions/worksuite/knowledge.actions';
import { AwardsForm } from '../../_components/awards-form';

export const dynamic = 'force-dynamic';

export default async function EditAwardPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const award = await getAwardById(id);
    if (!award) notFound();
    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <AwardsForm mode="edit" award={award as any} />
        </div>
    );
}
