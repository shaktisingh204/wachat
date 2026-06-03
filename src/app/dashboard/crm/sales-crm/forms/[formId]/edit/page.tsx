'use client';

import { Skeleton } from '@/components/zoruui';
import { Suspense, useEffect, useState } from 'react';
import { getCrmFormById } from '@/app/actions/crm-forms.actions';
import { useParams } from 'next/navigation';
import { CrmFormBuilder } from '@/components/zoruui-domain/website-builder/crm-form-builder';
import type { WithId, CrmForm } from '@/lib/definitions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

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
    const router = useRouter();
    const { toast } = useToast();
    const formId = params.formId as string;

    const [initialForm, setInitialForm] = useState<WithId<CrmForm> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (formId) {
            getCrmFormById(formId).then(data => {
                if (!data) {
                    toast({ title: 'Error', description: 'Form not found.', variant: 'destructive' });
                    router.push('/dashboard/crm/sales-crm/forms');
                } else {
                    setInitialForm(data);
                }
                setIsLoading(false);
            });
        }
    }, [formId, router, toast]);

    if (isLoading) {
        return <EditFormSkeleton />;
    }

    if (!initialForm) {
        return <EditFormSkeleton />;
    }

    return (
        <div className="h-full flex flex-col">
            <CrmFormBuilder initialForm={initialForm} />
        </div>
    );
}

export default function EditFormPage() {
  return (
    <Suspense fallback={<EditFormSkeleton />}>
        <EditFormPageContent />
    </Suspense>
  );
}
