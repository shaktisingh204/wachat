'use client';

import { Skeleton, cn } from '@/components/zoruui';
import {
  cn as _zoruCn,
  Suspense } from 'react';
import { CrmFormBuilder } from '@/components/wabasimplify/crm-form-builder';

void _zoruCn;

function NewFormSkeleton() {
    return (
        <div className="flex flex-col h-full">
            <ZoruSkeleton className="h-16 w-full" />
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-[1fr_420px] gap-0 min-h-0">
                <div className="lg:col-span-2 xl:col-span-1 p-4">
                    <ZoruSkeleton className="h-full w-full" />
                </div>
                <div className="hidden lg:block p-4">
                    <ZoruSkeleton className="h-full w-full" />
                </div>
            </div>
        </div>
    );
}

export default function NewCrmFormPage() {
    return (
        <Suspense fallback={<NewFormSkeleton />}>
            <CrmFormBuilder />
        </Suspense>
    );
}
