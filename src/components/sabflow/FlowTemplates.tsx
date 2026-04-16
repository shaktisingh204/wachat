'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  LuUserRoundSearch,
  LuHeadphones,
  LuMessageSquareText,
  LuBrain,
  LuChevronRight,
  LuLoader,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { createSabFlow } from '@/app/actions/sabflow';
import type { Group, Edge, Variable, SabFlowTheme } from '@/lib/sabflow/types';

/* ── Template definition ────────────────────────────────────────────────── */

type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  groups: Group[];
  edges: Edge[];
  variables: Variable[];
  theme: SabFlowTheme;
  settings: Record<string, unknown>;
};

/* ── Template data ──────────────────────────────────────────────────────── */

const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'lead-capture',
    name: 'Lead Capture',
    description: 'Collect name, email, and phone number from prospects.',
    emoji: '🎯',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    icon: LuUserRoundSearch,
    variables: [
      { id: crypto.randomUUID(), name: 'name' },
      { id: crypto.randomUUID(), name: 'email' },
      { id: crypto.randomUUID(), name: 'phone' },
    ],
    theme: {},
    settings: {},
    edges: [],
    groups: [
      {
        id: crypto.randomUUID(),
        title: 'Welcome',
        graphCoordinates: { x: 340, y: 80 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: { content: "Hi there! 👋 I'd love to learn a bit about you. What's your name?" },
          },
          {
            id: crypto.randomUUID(),
            type: 'text_input',
            groupId: '',
            options: { variableName: 'name', placeholder: 'Your full name…' },
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: 'Contact details',
        graphCoordinates: { x: 340, y: 300 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: { content: 'Nice to meet you, {{name}}! What is your email address?' },
          },
          {
            id: crypto.randomUUID(),
            type: 'email_input',
            groupId: '',
            options: { variableName: 'email', placeholder: 'you@example.com' },
          },
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: { content: 'And your phone number?' },
          },
          {
            id: crypto.randomUUID(),
            type: 'phone_input',
            groupId: '',
            options: { variableName: 'phone', placeholder: '+1 (555) 000-0000' },
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: 'Thank you',
        graphCoordinates: { x: 340, y: 560 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: { content: 'Thanks, {{name}}! We will be in touch soon. 🎉' },
          },
        ],
      },
    ],
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    description: 'Route users to the right support agent or knowledge base.',
    emoji: '🎧',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
    icon: LuHeadphones,
    variables: [
      { id: crypto.randomUUID(), name: 'issue_type' },
      { id: crypto.randomUUID(), name: 'description' },
    ],
    theme: {},
    settings: {},
    edges: [],
    groups: [
      {
        id: crypto.randomUUID(),
        title: 'Greeting',
        graphCoordinates: { x: 340, y: 80 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: { content: 'Hello! How can I help you today? Please choose a topic:' },
          },
          {
            id: crypto.randomUUID(),
            type: 'choice_input',
            groupId: '',
            options: { variableName: 'issue_type' },
            items: [
              { id: crypto.randomUUID(), content: 'Billing & Payments' },
              { id: crypto.randomUUID(), content: 'Technical Issue' },
              { id: crypto.randomUUID(), content: 'Account Management' },
              { id: crypto.randomUUID(), content: 'Something else' },
            ],
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: 'Describe issue',
        graphCoordinates: { x: 340, y: 320 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: { content: 'Please describe your issue in a few words.' },
          },
          {
            id: crypto.randomUUID(),
            type: 'text_input',
            groupId: '',
            options: { variableName: 'description', placeholder: 'Describe your issue…', isLong: true },
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: 'Confirmation',
        graphCoordinates: { x: 340, y: 560 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: {
              content:
                "Got it! Your request has been logged under **{{issue_type}}**. Our team will get back to you within 24 hours.",
            },
          },
        ],
      },
    ],
  },
  {
    id: 'feedback-survey',
    name: 'Feedback Survey',
    description: 'Gather product or service feedback with ratings and comments.',
    emoji: '📝',
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    icon: LuMessageSquareText,
    variables: [
      { id: crypto.randomUUID(), name: 'rating' },
      { id: crypto.randomUUID(), name: 'feedback' },
      { id: crypto.randomUUID(), name: 'recommend' },
    ],
    theme: {},
    settings: {},
    edges: [],
    groups: [
      {
        id: crypto.randomUUID(),
        title: 'Welcome',
        graphCoordinates: { x: 340, y: 80 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: {
              content:
                "Thanks for using our service! We'd love to hear your feedback. It only takes 1 minute. 🙏",
            },
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: 'Rating',
        graphCoordinates: { x: 340, y: 280 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: { content: 'How would you rate your experience overall?' },
          },
          {
            id: crypto.randomUUID(),
            type: 'rating_input',
            groupId: '',
            options: { variableName: 'rating', max: 5, icon: 'Star' },
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: 'Comments',
        graphCoordinates: { x: 340, y: 480 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: { content: 'Any additional comments or suggestions?' },
          },
          {
            id: crypto.randomUUID(),
            type: 'text_input',
            groupId: '',
            options: { variableName: 'feedback', placeholder: 'Your feedback…', isLong: true },
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: 'Thank you',
        graphCoordinates: { x: 340, y: 700 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: {
              content: 'Thank you for your feedback! You gave us **{{rating}} stars**. We really appreciate it. ⭐',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'quiz',
    name: 'Quiz',
    description: 'Engage users with a trivia or knowledge quiz.',
    emoji: '🧠',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
    icon: LuBrain,
    variables: [
      { id: crypto.randomUUID(), name: 'q1_answer' },
      { id: crypto.randomUUID(), name: 'q2_answer' },
      { id: crypto.randomUUID(), name: 'participant_name' },
    ],
    theme: {},
    settings: {},
    edges: [],
    groups: [
      {
        id: crypto.randomUUID(),
        title: 'Intro',
        graphCoordinates: { x: 340, y: 80 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: { content: "Welcome to the quiz! 🧠 Let's get started. What's your name?" },
          },
          {
            id: crypto.randomUUID(),
            type: 'text_input',
            groupId: '',
            options: { variableName: 'participant_name', placeholder: 'Your name…' },
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: 'Question 1',
        graphCoordinates: { x: 340, y: 300 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: { content: 'Question 1: What is the capital of France?' },
          },
          {
            id: crypto.randomUUID(),
            type: 'choice_input',
            groupId: '',
            options: { variableName: 'q1_answer' },
            items: [
              { id: crypto.randomUUID(), content: 'London' },
              { id: crypto.randomUUID(), content: 'Berlin' },
              { id: crypto.randomUUID(), content: 'Paris' },
              { id: crypto.randomUUID(), content: 'Madrid' },
            ],
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: 'Question 2',
        graphCoordinates: { x: 340, y: 540 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: { content: 'Question 2: How many continents are there?' },
          },
          {
            id: crypto.randomUUID(),
            type: 'choice_input',
            groupId: '',
            options: { variableName: 'q2_answer' },
            items: [
              { id: crypto.randomUUID(), content: '5' },
              { id: crypto.randomUUID(), content: '6' },
              { id: crypto.randomUUID(), content: '7' },
              { id: crypto.randomUUID(), content: '8' },
            ],
          },
        ],
      },
      {
        id: crypto.randomUUID(),
        title: 'Results',
        graphCoordinates: { x: 340, y: 780 },
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            groupId: '',
            options: {
              content:
                'Great job, {{participant_name}}! You answered: Q1 → {{q1_answer}}, Q2 → {{q2_answer}}. Stay tuned for your score!',
            },
          },
        ],
      },
    ],
  },
];

/* ── FlowTemplates ──────────────────────────────────────────────────────── */

type Props = {
  onFlowCreated?: () => void;
};

export function FlowTemplates({ onFlowCreated }: Props) {
  const router = useRouter();
  const [creating, setCreating] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleUseTemplate = (template: TemplateDefinition) => {
    if (isPending || creating) return;
    setCreating(template.id);

    startTransition(async () => {
      const result = await createSabFlow(template.name);
      if ('error' in result) {
        setCreating(null);
        return;
      }

      // Navigate to editor — the flow is created blank; template blocks would need
      // a richer server action to pre-fill, so for now we navigate to the editor.
      router.push(`/dashboard/sabflow/flow-builder/${result.id}`);
      onFlowCreated?.();
      setCreating(null);
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
          Start from a template
        </h2>
        <span className="text-[11px] text-zinc-400">{TEMPLATES.length} templates</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TEMPLATES.map((tpl) => {
          const Icon = tpl.icon;
          const isLoading = creating === tpl.id;

          return (
            <button
              key={tpl.id}
              type="button"
              disabled={!!creating}
              onClick={() => handleUseTemplate(tpl)}
              className={cn(
                'group relative flex flex-col gap-3 rounded-xl border p-4 text-left',
                'transition-all duration-200',
                tpl.bgColor,
                'hover:shadow-md hover:scale-[1.02]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
                creating && !isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg bg-white dark:bg-zinc-900 shadow-sm border border-zinc-100 dark:border-zinc-800',
                  tpl.color,
                )}
              >
                {isLoading ? (
                  <LuLoader className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                )}
              </div>

              {/* Text */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                  <span>{tpl.emoji}</span>
                  <span>{tpl.name}</span>
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                  {tpl.description}
                </span>
              </div>

              {/* Arrow hint on hover */}
              <LuChevronRight
                className={cn(
                  'absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-transform',
                  tpl.color,
                  'opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5',
                )}
                strokeWidth={2}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
