'use client';

import { Suspense, useEffect, useState } from 'react';
import { getCrmFormById } from '@/app/actions/crm-forms.actions';
import { notFound, useParams } from 'next/navigation';
import { CrmFormBuilder } from '@/components/wabasimplify/crm-form-builder';
import type { WithId, CrmForm } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';

function EditFormSkeleton() {
    return (
        <div className="flex flex-col h-full">
            <Skeleton className="h-16 w-full" />
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-[1fr_420px] gap-0 min-h-0">
                <div className="lg:col-span-2 xl:col-span-1 p-4">
                    <Skeleton className="h-full w-full" />
                </div>
                <div className="hidden lg:block p-4">
                    <Skeleton className="h-full w-full" />
                </div>
            </div>
        </div>
    );
}


function EditFormPageContent() {
    const params = useParams();
    const formId = params.formId as string;
    const [form, setForm] = useState<WithId<CrmForm> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (formId) {
            getCrmFormById(formId).then(data => {
                setForm(data);
                setIsLoading(false);
            });
        }
    }, [formId]);
    
    if (isLoading) {
        return <EditFormSkeleton />;
    }

    if (!form) {
        notFound();
    }
    
    return <CrmFormBuilder initialForm={form} />;
}


export default function EditFormPage() {
  return (
    <Suspense fallback={<EditFormSkeleton />}>
        <EditFormPageContent />
    </Suspense>
  );
}
