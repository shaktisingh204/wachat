'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateTemplateForm } from '@/components/wabasimplify/create-template-form';

const LoadingSkeleton = () => (
    <div className="flex flex-col gap-8">
      <div>
        <Skeleton className="h-10 w-48 mb-4" />
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3 mt-2" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
);

// We can reuse the existing form component but pass a different action to it.
// This page is a wrapper to provide the correct server action and context.
function AdminCreateLibraryTemplatePage() {
    return (
        <div className="flex flex-col gap-8">
            <div>
                <Button variant="ghost" asChild className="mb-4 -ml-4">
                <Link href="/admin/dashboard/template-library">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Library
                </Link>
                </Button>
                <h1 className="text-3xl font-bold font-headline">Add New Library Template</h1>
                <p className="text-muted-foreground">Create a new template that will be available to all users.</p>
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
        <Suspense fallback={<LoadingSkeleton />}>
            <AdminCreateLibraryTemplatePage />
        </Suspense>
    )
}
