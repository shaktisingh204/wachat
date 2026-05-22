'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Separator,
} from '@/components/zoruui';
import {
  ChevronLeft,
  GitFork,
  Lightbulb } from 'lucide-react';

import Link from 'next/link';

const commonPatterns = [
  {
    title: 'Lead generation',
    description: 'Capture valuable customer information directly in WhatsApp.',
    steps: [
      'Create a "Welcome" screen with a heading and body text explaining the offer.',
      'Add `TextInput` components for Name, Email, and Phone Number.',
      'The footer button should navigate to a "Thank you" screen.',
      'The final screen can confirm submission, e.g. "Thanks, a representative will contact you shortly!"',
    ],
  },
  {
    title: 'Appointment booking',
    description: 'Allow customers to schedule appointments without leaving the chat.',
    steps: [
      'Use a `DatePicker` component to let users select a date.',
      'Add a `Dropdown` or `RadioButtons` for available time slots.',
      'Use a `TextInput` for any special requests.',
      'The footer button can submit this data to your endpoint for processing.',
      'Consider a final screen that confirms the appointment details.',
    ],
  },
  {
    title: 'Customer feedback survey',
    description: 'Gather feedback with simple, interactive surveys.',
    steps: [
      'Use `RadioButtons` for single-choice questions (e.g. star ratings).',
      'Use `CheckboxGroup` for multiple-choice questions.',
      'Add a `TextInput` for open-ended comments or suggestions.',
      'The final button submits the survey data.',
    ],
  },
];

export default function FlowsUserGuidePage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <ZoruButton variant="ghost" size="sm" asChild className="-ml-2 mb-4">
          <Link href="/wachat/flows">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Meta Flows
          </Link>
        </ZoruButton>

        <ZoruPageHeader>
          <ZoruPageHeading>
            <ZoruPageTitle>
              <span className="inline-flex items-center gap-3">
                <GitFork className="h-7 w-7" />
                Building interactive experiences with Meta Flows
              </span>
            </ZoruPageTitle>
            <ZoruPageDescription>
              A guide to creating multi-step, interactive forms and journeys inside WhatsApp.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </ZoruPageHeader>
      </div>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>What are Meta Flows?</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent className="space-y-4">
          <p className="text-zoru-ink">
            Meta Flows are rich, native experiences that you can launch within WhatsApp conversations.
            Think of them as mini-apps or forms inside the chat. Instead of asking a user for their
            name, then their email, then their availability one message at a time, you can send a
            single Flow that collects all this information on one or more screens.
          </p>
          <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-1 h-5 w-5 flex-shrink-0 text-zoru-ink" />
              <div>
                <h4 className="font-semibold text-zoru-ink">Key advantage</h4>
                <p className="text-sm text-zoru-ink-muted">
                  Flows reduce friction for the user, leading to higher completion rates for tasks
                  like booking appointments, generating leads, or collecting feedback.
                </p>
              </div>
            </div>
          </div>
        </ZoruCardContent>
      </ZoruCard>

      <ZoruSeparator />

      <div>
        <h2 className="text-2xl text-zoru-ink">Common patterns & use cases</h2>
        <p className="mt-1 text-zoru-ink-muted">
          Here are some ideas for flows you can build, and how to structure them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {commonPatterns.map((pattern) => (
          <ZoruCard key={pattern.title} className="flex flex-col">
            <ZoruCardHeader>
              <ZoruCardTitle>{pattern.title}</ZoruCardTitle>
              <ZoruCardDescription>{pattern.description}</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent className="flex-grow">
              <ol className="list-inside list-decimal space-y-2 text-sm text-zoru-ink">
                {pattern.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </ZoruCardContent>
          </ZoruCard>
        ))}
      </div>
    </div>
  );
}
