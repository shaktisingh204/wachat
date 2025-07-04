'use client';

import React from 'react';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FacebookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-full">
      {children}
      <div className="fixed bottom-8 right-8 z-50">
          <Button asChild size="lg" className="rounded-full h-16 w-16 shadow-lg">
              <Link href="/dashboard/facebook/create-post">
                  <Pencil className="h-6 w-6" />
                  <span className="sr-only">Create Post</span>
              </Link>
          </Button>
      </div>
    </div>
  );
}
