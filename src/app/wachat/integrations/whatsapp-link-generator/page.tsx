'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import { Link as LinkIcon, FolderX } from 'lucide-react';
import type { WithId } from 'mongodb';

import {
  WaPage,
  PageHeader,
  Section,
  PhoneFrame,
  ChatBubble,
  EmptyState,
} from '@/components/wachat-ui';
import { getProjectById } from '@/app/actions/project.actions';
import type { Project } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { WhatsappLinkGenerator } from '@/components/zoruui-domain/whatsapp-link-generator';

export default function WhatsappLinkGeneratorPage() {
  const { activeProject } = useProject();
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [isLoading, startLoading] = useTransition();

  useEffect(() => {
    const id = activeProject?._id?.toString();
    if (id) {
      startLoading(async () => {
        const data = await getProjectById(id);
        setProject(data);
      });
    }
  }, [activeProject]);

  return (
    <WaPage>
      <PageHeader
        title="WhatsApp link generator"
        description="Create wa.me links with pre-filled messages and UTM parameters."
        kicker="Wachat · integrations"
        backHref="/wachat/integrations"
        eyebrowIcon={LinkIcon}
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
      ) : !project ? (
        <EmptyState
          icon={FolderX}
          title="No project selected"
          description="Pick a project from the Wachat home page to generate links."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Section title="Builder" description="Configure the link, message, and tracking.">
            <WhatsappLinkGenerator project={project} />
          </Section>

          <Section title="Preview" description="What the customer sees after they click.">
            <PhoneFrame title={project.name || 'Your business'} subtitle="business account">
              <ChatBubble who="them" text="Hi, found you via the link." time="9:41" delay={0.05} />
              <ChatBubble who="us" text="Hey! Happy to help. What can we do for you today?" time="9:41" delay={0.2} />
              <ChatBubble who="them" text="I need help with pricing." time="9:42" delay={0.4} />
              <ChatBubble who="us" kind="cta" text="Sure thing. Sending the link now." time="9:42" delay={0.55} />
            </PhoneFrame>
          </Section>
        </div>
      )}
    </WaPage>
  );
}
