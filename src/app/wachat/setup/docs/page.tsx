export const dynamic = 'force-dynamic';

import React from 'react';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { CardTitle, CardDescription } from '@/components/sabcrm/20ui';

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
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Setup', href: '/wachat/setup' },
        { label: 'Docs' },
      ]}
      title="WhatsApp Setup & Documentation"
      description="Your complete guide to setting up and managing your WhatsApp Business Account integration. Includes real-time diagnostic tools and a comprehensive knowledge base."
      width="wide"
    >
      <div className="flex flex-col gap-10">
        <div>
          <Link href="/wachat/setup" className="u-btn u-btn--ghost u-btn--md -ml-2">
            <ChevronLeft size={14} aria-hidden="true" />
            <span className="u-btn__label">Back to Setup Options</span>
          </Link>
        </div>

        <section>
          <div className="mb-6 border-b border-[var(--st-border)] pb-2">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Manual Setup Guide
            </CardTitle>
            <CardDescription>
              Follow these steps to connect your Meta App directly using Developer credentials.
            </CardDescription>
          </div>
          <div className="grid gap-6">
            <PrerequisitesCard />
            <FindIdsCard />
            <GenerateTokenCard />
            <ConnectToSabNodeCard />
          </div>
        </section>

        <section>
          <div className="mb-6 border-b border-[var(--st-border)] pb-2">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Diagnostic Tools
            </CardTitle>
            <CardDescription>
              Real-time status checks and testing utilities to ensure your connection is healthy.
            </CardDescription>
          </div>
          <WhatsAppTools />
        </section>

        <section>
          <div className="mb-6 border-b border-[var(--st-border)] pb-2">
            <CardTitle className="text-2xl font-semibold tracking-tight">
              Knowledge Base
            </CardTitle>
            <CardDescription>
              Searchable articles, troubleshooting steps, and best practices.
            </CardDescription>
          </div>
          <DocumentationList />
        </section>
      </div>
    </WachatPage>
  );
}
