import { ClayCard } from '@/components/clay';
import { CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, { title: string; body: string }> = {
  proposal: {
    title: 'Proposal signed',
    body: 'Thank you — your acceptance has been recorded.',
  },
  estimate: {
    title: 'Estimate accepted',
    body: 'Thank you — we will follow up with next steps.',
  },
  invoice: {
    title: 'Payment recorded',
    body: 'Thank you — your payment will be reconciled shortly.',
  },
  contract: {
    title: 'Contract signed',
    body: 'Thank you — a signed copy has been stored for both parties.',
  },
  lead: {
    title: 'Thanks for reaching out',
    body: 'We received your details and will be in touch soon.',
  },
  ticket: {
    title: 'Ticket submitted',
    body: 'Thank you — a support agent will respond shortly.',
  },
  gdpr: {
    title: 'Preferences saved',
    body: 'Your consent choices have been recorded.',
  },
};

interface PageProps {
  searchParams: Promise<{ type?: string }>;
}

export default async function ThanksPage({ searchParams }: PageProps) {
  const { type } = await searchParams;
  const m = (type && MESSAGES[type]) || {
    title: 'Thank you',
    body: 'Your submission has been received.',
  };
  return (
    <ClayCard>
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-clay-rose-soft">
          <CheckCircle2 className="h-6 w-6 text-clay-rose-ink" />
        </div>
        <h1 className="text-[18px] font-semibold text-clay-ink">{m.title}</h1>
        <p className="max-w-md text-[13px] text-clay-ink-muted">{m.body}</p>
      </div>
    </ClayCard>
  );
}
