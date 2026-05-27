'use client';

import { Skeleton } from '@/components/zoruui';
import { EmbeddedForm } from '@/components/zoruui-domain/embedded-form';
import { getCrmFormById } from '@/app/actions/crm-forms.actions';
import { useEffect, useState, use, useCallback } from 'react';
import type { WithId, CrmForm } from '@/lib/definitions';
import { AlertCircle } from 'lucide-react';

function FormSkeleton() {
    return (
        <div className="p-4 w-full max-w-lg mx-auto space-y-6">
            <div className="space-y-2 text-center">
                <Skeleton className="h-16 w-16 rounded-full mx-auto" />
                <Skeleton className="h-8 w-3/4 mx-auto" />
                <Skeleton className="h-4 w-1/2 mx-auto" />
            </div>
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
        </div>
    );
}

function FormError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="p-4 w-full max-w-lg mx-auto mt-10">
            <div className="p-6 border-2 border-destructive/20 bg-destructive/10 text-destructive rounded-lg text-center space-y-4">
                <AlertCircle className="mx-auto h-10 w-10" />
                <h3 className="font-semibold text-lg">Failed to load form</h3>
                <p className="text-sm">{message}</p>
                <button 
                    onClick={onRetry}
                    className="mt-4 px-4 py-2 bg-destructive text-white rounded-md hover:bg-destructive/90 transition-colors"
                >
                    Retry
                </button>
            </div>
        </div>
    );
}

export default function EmbeddedFormPage(props: { params: Promise<{ formId: string }> }) {
    const params = use(props.params);
    const [form, setForm] = useState<WithId<CrmForm> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchForm = useCallback(async (isInitial = true) => {
        if (isInitial) {
            setIsLoading(true);
        }
        setError(null);
        try {
            const data = await getCrmFormById(params.formId);
            if (!data) {
                throw new Error('Form not found.');
            }
            setForm(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred while fetching the form.');
        } finally {
            if (isInitial) {
                setIsLoading(false);
            }
        }
    }, [params.formId]);

    useEffect(() => {
        fetchForm();
        
        // Polling for real-time updates every 60 seconds
        const intervalId = setInterval(() => {
            fetchForm(false);
        }, 60000);

        return () => clearInterval(intervalId);
    }, [fetchForm]);

    if (isLoading) {
        return (
            <main className="min-h-screen bg-transparent p-0">
                <FormSkeleton />
            </main>
        );
    }

    if (error || !form) {
        return (
            <main className="min-h-screen bg-transparent p-0">
                <FormError message={error || 'Form not found.'} onRetry={() => fetchForm(true)} />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-transparent p-0">
            <EmbeddedForm form={form} />
        </main>
    );
}
