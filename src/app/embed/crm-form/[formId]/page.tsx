// This file is deprecated and no longer used for embedding.
// It is kept for historical purposes or if a direct link to the form is needed in the future.

'use client';

import { EmbeddedForm } from '@/components/wabasimplify/embedded-form';
import { getCrmFormById } from '@/app/actions/crm-forms.actions';
import { useEffect, useState } from 'react';
import type { WithId, CrmForm } from '@/lib/definitions';
import { Skeleton } from '@/components/ui/skeleton';

export default function EmbeddedFormPage({ params }: { params: { formId: string } }) {
    const [form, setForm] = useState<WithId<CrmForm> | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        getCrmFormById(params.formId).then(data => {
            setForm(data);
            setIsLoading(false);
        });
    }, [params.formId]);

    if (isLoading) {
        return <div className="p-4"><Skeleton className="h-96 w-full max-w-lg mx-auto" /></div>;
    }
    
    if (!form) {
        return <div className="p-4 text-center">Form not found.</div>;
    }

    return (
        <main className="min-h-screen bg-muted p-4 md:p-8">
            <EmbeddedForm form={form} />
        </main>
    )
}
