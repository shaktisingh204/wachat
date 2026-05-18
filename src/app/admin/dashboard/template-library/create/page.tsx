'use client';

import { ZoruButton, ZoruSkeleton } from '@/components/zoruui';
import {
  Suspense,
  useEffect,
  useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { getProjectById } from '@/app/actions/index.ts';

const LoadingZoruSkeleton = () => (
    <div className="flex flex-col gap-8">
      <div>
        <ZoruSkeleton className="h-10 w-48 mb-4" />
        <ZoruSkeleton className="h-8 w-1/3" />
        <ZoruSkeleton className="h-4 w-2/3 mt-2" />
      </div>
      <div className="space-y-6">
        <ZoruSkeleton className="h-48 w-full" />
        <ZoruSkeleton className="h-64 w-full" />
      </div>
    </div>
);

const CreateTemplateForm = dynamic(
  () => import('@/components/wabasimplify/create-template-form').then(mod => mod.CreateTemplateForm),
  { loading: () => <LoadingZoruSkeleton /> }
);

// We can reuse the existing form component but pass a different action to it.
// This page is a wrapper to provide the correct server action and context.
function AdminCreateLibraryTemplatePage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <ZoruButton variant="ghost" asChild className="mb-4 -ml-4">
                <Link href="/admin/dashboard/template-library">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Library
                </Link>
                </ZoruButton>
                <h1 className="text-3xl text-zoru-ink">Add New Library Template</h1>
                <p className="text-zoru-ink-muted">Create a new template that will be available to all users.</p>
            </div>
            
            {/* The form component will need to be adapted to take a server action as a prop */}
            <CreateTemplateForm 
                isAdminForm={true}
            />

        </div>
    )
}

export default function AdminCreateLibraryTemplatePageWrapper() {
    return (
        <Suspense fallback={<LoadingZoruSkeleton />}>
            <AdminCreateLibraryTemplatePage />
        </Suspense>
    )
}
