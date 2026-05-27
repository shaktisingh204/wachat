'use client';

import { Blocks, GitFork, Lightbulb } from 'lucide-react';
import { m } from 'motion/react';

import { WaPage, PageHeader, Section } from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

const commonPatterns = [
  {
    title: 'Lead generation',
    description: 'Capture valuable customer information directly in WhatsApp.',
    steps: [
      'Create a "Welcome" screen with a heading and body text explaining the offer.',
      'Add `TextInput` components for name, email, and phone number.',
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
    category: 'Text and layout',
    items: [
      { name: 'TextHeading', description: 'Large, prominent text for screen titles.' },
      { name: 'TextSubheading', description: 'Medium text for section headings.' },
      { name: 'TextBody', description: 'Standard text for descriptions and instructions.' },
      { name: 'TextCaption', description: 'Small text for hints or disclaimers.' },
    ],
  },
  {
    category: 'Form inputs',
    items: [
      { name: 'TextInput', description: 'Single-line text field (text, email, phone, number).' },
      { name: 'TextArea', description: 'Multi-line text input for longer responses.' },
      { name: 'DatePicker', description: 'Interactive calendar widget for selecting dates.' },
      { name: 'Dropdown', description: 'Collapsible list for selecting one option from many.' },
      { name: 'RadioButtons', description: 'List of options where only one can be selected.' },
      { name: 'CheckboxGroup', description: 'List of options where multiple can be selected.' },
      { name: 'OptIn', description: 'Checkbox specialized for consent or terms agreement.' },
    ],
  },
  {
    category: 'Media and advanced',
    items: [
      { name: 'Image', description: 'Static image display within the flow.' },
      { name: 'PhotoPicker', description: 'Capture or select images.' },
      { name: 'DocumentPicker', description: 'Upload documents (PDFs, etc).' },
    ],
  },
];

export default function FlowsUserGuidePage() {
  return (
    <WaPage>
      <PageHeader
        title="Building interactive experiences with Meta flows"
        description="A guide to creating multi-step, interactive forms and journeys inside WhatsApp."
        kicker="Wachat"
        eyebrowIcon={GitFork}
        backHref="/wachat/flows"
      />

      <Section title="What are Meta flows?" description="The short version.">
        <p className="text-[13.5px] leading-relaxed text-zinc-700">
          Meta flows are rich, native experiences you can launch inside WhatsApp conversations. Think
          of them as mini-apps or forms inside the chat. Instead of asking a user for their name, then
          their email, then their availability one message at a time, you can send a single flow that
          collects all of this information across one or more screens.
        </p>
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} aria-hidden />
            <div>
              <h4 className="text-[13px] font-semibold tracking-tight text-zinc-950">Key advantage</h4>
              <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-600">
                Flows reduce friction, leading to higher completion rates for tasks like booking
                appointments, generating leads, or collecting feedback.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <div className="mt-10">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Common patterns and use cases</h2>
        <p className="mt-1 text-[13px] text-zinc-600">
          Ideas for flows you can build and how to structure them.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {commonPatterns.map((pattern, i) => (
          <m.article
            key={pattern.title}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.04 + i * 0.05, ease: EASE_OUT }}
            className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <h3 className="text-[14px] font-semibold tracking-tight text-zinc-950">{pattern.title}</h3>
            <p className="mt-1 text-[12.5px] text-zinc-500">{pattern.description}</p>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-[12.5px] leading-relaxed text-zinc-700">
              {pattern.steps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </m.article>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-950">
          <Blocks className="h-5 w-5" strokeWidth={2.25} style={{ color: 'var(--mt-accent)' }} aria-hidden />
          Available flow components
        </h2>
        <p className="mt-1 text-[13px] text-zinc-600">
          Official building blocks available in the Meta flows API. Combine them to build rich
          experiences.
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {availableComponents.map((category, i) => (
          <m.article
            key={category.category}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: 0.04 + i * 0.05, ease: EASE_OUT }}
            className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5"
          >
            <h3 className="text-[14px] font-semibold tracking-tight text-zinc-950">{category.category}</h3>
            <div className="mt-3 space-y-3">
              {category.items.map((item) => (
                <div key={item.name} className="flex flex-col">
                  <span
                    className="w-fit rounded-md px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-zinc-700"
                    style={{ background: 'var(--mt-accent-soft)' }}
                  >
                    {item.name}
                  </span>
                  <span className="mt-1 text-[12.5px] text-zinc-600">{item.description}</span>
                </div>
              ))}
            </div>
          </m.article>
        ))}
      </div>
    </WaPage>
  );
}
