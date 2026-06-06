'use client';

import * as React from 'react';
import { Button, Card, Input } from '@/components/sabcrm/20ui';

export default function SigningPortalPage() {
  return (
    <div className="min-h-screen bg-[var(--st-bg)] flex flex-col">
      <header className="h-16 border-b border-[var(--st-border)] flex items-center justify-between px-6 bg-[var(--st-bg-secondary)]">
        <div className="font-semibold text-lg text-[var(--st-text)]">SabSign</div>
        <Button>Finish & Sign</Button>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-4xl w-full p-8 bg-white text-black min-h-[800px] shadow-sm">
          <h1 className="text-2xl font-bold mb-4">Document Preview</h1>
          <p className="text-gray-500">Signer view with fields will be rendered here...</p>
        </Card>
      </main>
    </div>
  );
}
