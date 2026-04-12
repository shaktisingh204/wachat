'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ToolShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function ToolShell({ title, description, children }: ToolShellProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link href="/dashboard/seo/tools">
              <ArrowLeft className="mr-2 h-4 w-4" /> All SEO Tools
            </Link>
          </Button>
          <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <Wrench className="h-7 w-7 text-primary" />
            {title}
          </h1>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
