'use client';

import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from '@/components/sabcrm/20ui';
import {
  Blocks,
  ChevronLeft,
  GitFork,
  Lightbulb,
} from 'lucide-react';

import Link from 'next/link';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

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

const availableComponents = [
  {
    category: 'Text & Layout',
    items: [
      { name: 'TextHeading', description: 'Large, prominent text for screen titles.' },
      { name: 'TextSubheading', description: 'Medium text for section headings.' },
      { name: 'TextBody', description: 'Standard text for descriptions and instructions.' },
      { name: 'TextCaption', description: 'Small text for hints or disclaimers.' },
    ],
  },
  {
    category: 'Form Inputs',
    items: [
      { name: 'TextInput', description: 'Single-line text field (supports text, email, phone, number).' },
      { name: 'TextArea', description: 'Multi-line text input for longer responses.' },
      { name: 'DatePicker', description: 'Interactive calendar widget for selecting dates.' },
      { name: 'Dropdown', description: 'Collapsible list for selecting one option from many.' },
      { name: 'RadioButtons', description: 'List of options where only one can be selected.' },
      { name: 'CheckboxGroup', description: 'List of options where multiple can be selected.' },
      { name: 'OptIn', description: 'Checkbox specialized for consent or terms agreement.' },
    ],
  },
  {
    category: 'Media & Advanced',
    items: [
      { name: 'Image', description: 'Static image display within the flow.' },
      { name: 'PhotoPicker', description: 'Allows users to capture or select and upload images.' },
      { name: 'DocumentPicker', description: 'Allows users to upload documents (PDFs, etc).' },
    ],
  },
];

export default function FlowsUserGuidePage() {
  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Meta Flows', href: '/wachat/flows' },
        { label: 'Guide' },
      ]}
      title={
        <span className="inline-flex items-center gap-3">
          <GitFork className="h-7 w-7" aria-hidden="true" />
          Building interactive experiences with Meta Flows
        </span>
      }
      description="A guide to creating multi-step, interactive forms and journeys inside WhatsApp."
    >
      <div className="flex flex-col gap-8">
        <div>
          <Link
            href="/wachat/flows"
            className="u-btn u-btn--ghost u-btn--sm -ml-2"
          >
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
            <span className="u-btn__label">Back to Meta Flows</span>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>What are Meta Flows?</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p>
              Meta Flows are rich, native experiences that you can launch within WhatsApp conversations.
              Think of them as mini-apps or forms inside the chat. Instead of asking a user for their
              name, then their email, then their availability one message at a time, you can send a
              single Flow that collects all this information on one or more screens.
            </p>
            <Callout tone="info" icon={Lightbulb} title="Key advantage">
              Flows reduce friction for the user, leading to higher completion rates for tasks
              like booking appointments, generating leads, or collecting feedback.
            </Callout>
          </CardBody>
        </Card>

        <Separator />

        <div>
          <h2 className="text-2xl">Common patterns &amp; use cases</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--st-text-secondary)' }}>
            Here are some ideas for flows you can build, and how to structure them.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {commonPatterns.map((pattern) => (
            <Card key={pattern.title} className="flex flex-col">
              <CardHeader>
                <CardTitle>{pattern.title}</CardTitle>
                <CardDescription>{pattern.description}</CardDescription>
              </CardHeader>
              <CardBody className="flex-grow">
                <ol className="list-inside list-decimal space-y-2 text-sm">
                  {pattern.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          ))}
        </div>
        <Separator />

        <div>
          <h2 className="text-2xl flex items-center gap-2">
            <Blocks className="h-6 w-6" aria-hidden="true" />
            Available flow components
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--st-text-secondary)' }}>
            These are the official building blocks available in the Meta Flows API. Combine them to build rich user experiences.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {availableComponents.map((category) => (
            <Card key={category.category} className="flex flex-col">
              <CardHeader>
                <CardTitle>{category.category}</CardTitle>
              </CardHeader>
              <CardBody className="flex-grow space-y-4">
                {category.items.map((item) => (
                  <div key={item.name} className="flex flex-col">
                    <Badge tone="neutral" kind="soft" className="font-mono w-fit">
                      {item.name}
                    </Badge>
                    <span className="text-sm mt-1" style={{ color: 'var(--st-text-secondary)' }}>{item.description}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </WachatPage>
  );
}
