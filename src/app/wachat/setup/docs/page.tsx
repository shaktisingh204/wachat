export const dynamic = 'force-dynamic';

import {
  Button,
} from '@/components/zoruui';
import React from 'react';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';

import {
  PrerequisitesCard,
  FindIdsCard,
  GenerateTokenCard,
  ConnectToSabNodeCard,
} from './components/SetupSteps';
import { DocumentationList } from './components/DocumentationList';
import { WhatsAppTools } from './components/WhatsAppTools';

export const metadata: Metadata = {
  title: 'WhatsApp Setup & Documentation | SabNode',
};

export default function ManualSetupDocsPage() {
  return (
    <div className="flex flex-col gap-10 pb-10">
      <div>
        <Button variant="ghost" asChild className="mb-4 -ml-4">
          <Link href="/wachat/setup">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Setup Options
          </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline">WhatsApp Setup & Documentation</h1>
        <p className="text-zoru-ink-muted mt-2 max-w-2xl">
          Your complete guide to setting up and managing your WhatsApp Business Account integration. Includes real-time diagnostic tools and a comprehensive knowledge base.
        </p>
      </div>

      <section>
        <div className="mb-6 border-b pb-2">
          <h2 className="text-2xl font-semibold tracking-tight">Manual Setup Guide</h2>
          <p className="text-zoru-ink-muted text-sm">Follow these steps to connect your Meta App directly using Developer credentials.</p>
        </div>
        <div className="grid gap-6">
          <PrerequisitesCard />
          <FindIdsCard />
          <GenerateTokenCard />
          <ConnectToSabNodeCard />
        </div>
      </section>

      <section>
        <div className="mb-6 border-b pb-2">
          <h2 className="text-2xl font-semibold tracking-tight">Diagnostic Tools</h2>
          <p className="text-zoru-ink-muted text-sm">Real-time status checks and testing utilities to ensure your connection is healthy.</p>
        </div>
        <WhatsAppTools />
      </section>

      <section>
        <div className="mb-6 border-b pb-2">
          <h2 className="text-2xl font-semibold tracking-tight">Knowledge Base</h2>
          <p className="text-zoru-ink-muted text-sm">Searchable articles, troubleshooting steps, and best practices.</p>
        </div>
        <DocumentationList />
      </section>
    </div>
  );
}
