'use client';

import { Button, Skeleton } from '@/components/sabcrm/20ui';
import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';

const LoadingUi20Skeleton = () => (
  <div className="flex flex-col gap-8 w-full animate-in fade-in duration-500">
    <div className="space-y-3">
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-10 w-1/2 md:w-1/3" />
      <Skeleton className="h-5 w-3/4 md:w-1/2" />
    </div>
    <div className="grid lg:grid-cols-3 gap-8 mt-4">
      <div className="lg:col-span-2 space-y-6">
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
      <div className="lg:col-span-1 space-y-6">
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    </div>
  </div>
);

const CreateTemplateForm = dynamic(
  () => import('@/components/20ui-domain/create-template-form').then(mod => mod.CreateTemplateForm),
  { loading: () => <LoadingUi20Skeleton /> }
);

// We can reuse the existing form component but pass a different action to it.
// This page is a wrapper to provide the correct server action and context.
function AdminCreateLibraryTemplatePage() {
    const [previewMode, setPreviewMode] = useState(false);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <Button variant="ghost" asChild className="mb-4 -ml-4">
                    <Link href="/admin/dashboard/template-library">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Library
                    </Link>
                    </Button>
                    <h1 className="text-3xl text-[var(--st-text)] font-semibold">Add New Library Template</h1>
                    <p className="text-[var(--st-text-secondary)] mt-1">Create a new template that will be available to all users.</p>
                </div>
                
                <Button 
                    variant={previewMode ? "default" : "outline"} 
                    onClick={() => setPreviewMode(!previewMode)}
                    className="shrink-0"
                >
                    {previewMode ? (
                        <><EyeOff className="mr-2 h-4 w-4" /> Exit Preview</>
                    ) : (
                        <><Eye className="mr-2 h-4 w-4" /> Preview as Standard User</>
                    )}
                </Button>
            </div>
            
            <div className={previewMode ? "border-2 border-dashed border-[var(--st-text-secondary)]/30 p-6 rounded-xl relative bg-[var(--st-bg-secondary)]/50" : ""}>
                {previewMode && (
                    <div className="absolute -top-3 right-4 bg-[var(--st-text)] text-white px-3 py-1 text-xs font-medium rounded-full z-10 shadow-sm">
                        Standard User View
                    </div>
                )}
                <CreateTemplateForm 
                    isAdminForm={!previewMode}
                />
            </div>
        </div>
    )
}

export default function AdminCreateLibraryTemplatePageWrapper() {
    return (
        <Suspense fallback={<LoadingUi20Skeleton />}>
            <AdminCreateLibraryTemplatePage />
        </Suspense>
    )
}
