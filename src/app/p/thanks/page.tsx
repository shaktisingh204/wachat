import React from "react";
import { ClayCard } from '@/components/clay';
import { CheckCircle2 } from 'lucide-react';
import { CountdownRedirect } from './countdown-redirect';

export const dynamic = 'force-dynamic';

const getMessages = (type?: string, name?: string) => {
  const base: Record<string, { title: string; body: string }> = {
    proposal: {
      title: 'Proposal signed',
      body: name ? `Thank you — your acceptance for ${name} has been recorded.` : 'Thank you — your acceptance has been recorded.',
    },
    estimate: {
      title: 'Estimate accepted',
      body: name ? `Thank you — we will follow up with next steps for ${name}.` : 'Thank you — we will follow up with next steps.',
    },
    invoice: {
      title: 'Payment recorded',
      body: name ? `Thank you — your payment for ${name} will be reconciled shortly.` : 'Thank you — your payment will be reconciled shortly.',
    },
    contract: {
      title: 'Contract signed',
      body: name ? `Thank you — a signed copy of ${name} has been stored for both parties.` : 'Thank you — a signed copy has been stored for both parties.',
    },
    lead: {
      title: 'Thanks for reaching out',
      body: name ? `We received your details regarding ${name} and will be in touch soon.` : 'We received your details and will be in touch soon.',
    },
    ticket: {
      title: 'Ticket submitted',
      body: name ? `Thank you — a support agent will respond shortly to your ticket: ${name}.` : 'Thank you — a support agent will respond shortly.',
    },
    gdpr: {
      title: 'Preferences saved',
      body: 'Your consent choices have been recorded.',
    },
  };
  
  if (type && base[type]) {
    return base[type];
  }
  
  return {
    title: 'Thank you',
    body: name ? `Your submission for ${name} has been received.` : 'Your submission has been received.',
  };
};

interface PageProps {
  searchParams: Promise<{ type?: string; name?: string; redirect?: string }>;
}

async function ThanksPageContent({ searchParams }: PageProps) {
  const { type, name, redirect } = await searchParams;
  const m = getMessages(type, name);

  return (
    <ClayCard>
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
          <CheckCircle2 className="h-6 w-6 text-accent-foreground" />
        </div>
        <h1 className="text-[18px] font-semibold text-foreground">{m.title}</h1>
        <p className="max-w-md text-[13px] text-muted-foreground">{m.body}</p>
        
        <CountdownRedirect redirectUrl={redirect || '/'} />
      </div>
    </ClayCard>
  );
}


export default function ThanksPage({ searchParams }: PageProps) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ThanksPageContent searchParams={searchParams} />
    </React.Suspense>
  );
}
