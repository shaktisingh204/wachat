"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardBody, useToast } from '@/components/sabcrm/20ui';
import { NodesSidebar } from './NodesSidebar';

export default function NodesSidebarPage() {
  const { toast } = useToast();

  return (
    <div className="20ui flex h-screen w-full bg-[var(--st-bg)] text-[var(--st-text-secondary)] font-sans overflow-hidden">
      <NodesSidebar />
      <main className="flex-1 flex flex-col items-center justify-center relative bg-[var(--st-bg)]">
        {/* Grid Background (static design pattern, tinted with the 20ui border token) */}
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_1px_1px,var(--st-border)_1px,transparent_0)] bg-[length:24px_24px]"
          aria-hidden="true"
        />

        <Card variant="elevated" padding="lg" className="z-10 max-w-md text-center">
          <CardHeader>
            <CardTitle>Flow Builder Sandbox</CardTitle>
            <CardDescription>
              Drag and drop nodes from the sidebar onto this canvas area.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div
              className="h-48 rounded-[var(--st-radius)] border-2 border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-center text-[var(--st-text-secondary)] font-medium"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                const type = e.dataTransfer.getData('application/reactflow');
                toast.success(`Dropped node of type: ${type}`);
              }}
            >
              Drop Zone
            </div>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
