export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { BookOpen, ChevronLeft, Stethoscope, Wrench } from 'lucide-react';

import { WaPage, PageHeader, Section, WaButton } from '@/components/wachat-ui';
import {
  PrerequisitesCard,
  FindIdsCard,
  GenerateTokenCard,
  ConnectToSabNodeCard,
} from './components/SetupSteps';
import { DocumentationList } from './components/DocumentationList';
import { WhatsAppTools } from './components/WhatsAppTools';

export const metadata: Metadata = {
  title: 'WhatsApp setup and documentation · SabNode',
};

export default function ManualSetupDocsPage() {
  return (
    <WaPage>
      <PageHeader
        title="WhatsApp setup and documentation"
        description="Your complete guide to setting up and managing the WhatsApp Business Account integration. Includes live diagnostic tools and a searchable knowledge base."
        kicker="Wachat · docs"
        backHref="/wachat/setup"
        eyebrowIcon={BookOpen}
        actions={
          <WaButton href="/wachat/setup" variant="outline" leftIcon={ChevronLeft}>
            Back to setup
          </WaButton>
        }
      />

      <div className="space-y-6">
        <Section
          title="Manual setup guide"
          description="Step through the developer credentials path if the embedded signup is not available."
        >
          <div className="grid gap-4">
            <PrerequisitesCard />
            <FindIdsCard />
            <GenerateTokenCard />
            <ConnectToSabNodeCard />
          </div>
        </Section>

        <Section
          title="Diagnostic tools"
          description="Real-time status checks and testing utilities to confirm your connection is healthy."
        >
          <WhatsAppTools />
        </Section>

        <Section
          title="Knowledge base"
          description="Searchable articles, troubleshooting steps, and best practices."
        >
          <DocumentationList />
        </Section>
      </div>
    </WaPage>
  );
}
