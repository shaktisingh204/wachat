/**
 * SabCRM - Help & Keyboard Shortcuts settings (`/dashboard/settings/crm/help`).
 *
 * A fully static reference page built on the 20ui design system. There is no
 * data fetching and no interactivity of its own, so this stays a server
 * component (it only renders 20ui client primitives).
 *
 * Three scannable sections:
 *
 *   1. Keyboard shortcuts - reference tables grouped by area (Global, Table,
 *      Record). Keys render as 20ui Kbd chips, alternative keys joined by a
 *      faint "or".
 *
 *   2. Getting started - interactive 20ui cards that link into the key SabCRM
 *      settings areas (Data model, Members, Import & export, Workflows).
 *
 *   3. Resources - documentation / support entries. These are honest
 *      placeholders: the external help destinations are not wired up yet, so
 *      each is tagged with a "Placeholder" Badge and is non-interactive.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  HelpCircle,
  Database,
  Users,
  ArrowDownUp,
  Workflow,
  BookOpen,
  LifeBuoy,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  Card,
  CardTitle,
  CardDescription,
  Table,
  TBody,
  Tr,
  Td,
  Kbd,
  Badge,
} from '@/components/sabcrm/20ui';

// ---------------------------------------------------------------------------
// Shortcut data
// ---------------------------------------------------------------------------

/** A single shortcut row: one or more key sequences plus what it does. */
interface Shortcut {
  /** Each entry is a chord rendered as one Kbd; multiple = alternatives. */
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  label: string;
  shortcuts: Shortcut[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'Global',
    shortcuts: [
      { keys: ['⌘ K'], description: 'Open the command menu' },
      { keys: ['/'], description: 'Focus search' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
  {
    label: 'Table',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Move between rows' },
      { keys: ['J', 'K'], description: 'Move between rows (vim style)' },
      { keys: ['Enter'], description: 'Open the focused record' },
      { keys: ['X'], description: 'Select the focused row' },
      { keys: ['Esc'], description: 'Clear selection or close the open panel' },
    ],
  },
  {
    label: 'Record',
    shortcuts: [
      { keys: ['⌘ ↵'], description: 'Submit the activity composer' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Getting-started cards
// ---------------------------------------------------------------------------

interface StartCard {
  href: string;
  icon: LucideIcon;
  title: string;
  meta: string;
}

const START_CARDS: StartCard[] = [
  {
    href: '/dashboard/settings/crm/data-model',
    icon: Database,
    title: 'Data model',
    meta: 'Shape your objects, fields, and relations to match how your team works.',
  },
  {
    href: '/dashboard/settings/crm/members',
    icon: Users,
    title: 'Members',
    meta: 'Invite teammates and review who has access to this workspace.',
  },
  {
    href: '/dashboard/settings/crm/import-export',
    icon: ArrowDownUp,
    title: 'Import & export',
    meta: 'Bring in existing records or export your data when you need it.',
  },
  {
    href: '/dashboard/settings/crm/automations',
    icon: Workflow,
    title: 'Workflows',
    meta: 'Automate repetitive work with triggers, conditions, and actions.',
  },
];

// ---------------------------------------------------------------------------
// Resource links (placeholders - external help isn't wired up yet)
// ---------------------------------------------------------------------------

interface Resource {
  icon: LucideIcon;
  title: string;
  meta: string;
}

const RESOURCES: Resource[] = [
  {
    icon: BookOpen,
    title: 'Documentation',
    meta: 'Guides and reference for working in SabCRM.',
  },
  {
    icon: LifeBuoy,
    title: 'Support',
    meta: 'Get in touch when you hit something we can help with.',
  },
];

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

/** Renders one shortcut's key chips, joining alternatives with a faint "or". */
function ShortcutKeys({ keys }: { keys: string[] }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5">
      {keys.map((key, i) => (
        <React.Fragment key={key}>
          {i > 0 ? (
            <span
              className="text-[11px] text-[var(--st-text-tertiary)]"
              aria-hidden="true"
            >
              or
            </span>
          ) : null}
          <Kbd>{key}</Kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

/** A section wrapper: heading + description, then the section body. */
function HelpSection({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-[var(--st-text)]">{title}</h2>
        <p className="max-w-[60ch] text-[13px] leading-relaxed text-[var(--st-text-secondary)]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmHelpSettingsPage(): React.JSX.Element {
  return (
    <div className="20ui mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle className="flex items-center gap-2">
            <HelpCircle size={18} aria-hidden="true" />
            Help & Shortcuts
          </PageTitle>
          <PageDescription>
            A quick reference for moving around SabCRM faster: keyboard
            shortcuts, jumping-off points for setup, and where to find more help.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {/* ----- Keyboard shortcuts ----- */}
      <HelpSection
        title="Keyboard shortcuts"
        description={
          <>
            Most actions have a shortcut. Press <Kbd>?</Kbd> anywhere to bring
            this list up without leaving what you&apos;re doing.
          </>
        }
      >
        <div className="flex flex-col gap-6">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-tertiary)]">
                {group.label}
              </h3>
              <Card variant="outlined" padding="none">
                <Table hover={false}>
                  <TBody>
                    {group.shortcuts.map((shortcut) => (
                      <Tr key={shortcut.description}>
                        <Td className="w-[180px] align-middle">
                          <ShortcutKeys keys={shortcut.keys} />
                        </Td>
                        <Td className="align-middle text-[13px] text-[var(--st-text-secondary)]">
                          {shortcut.description}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </Card>
            </div>
          ))}
        </div>
      </HelpSection>

      {/* ----- Getting started ----- */}
      <HelpSection
        title="Getting started"
        description="New here, or setting up a fresh workspace? These are the areas most teams configure first."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {START_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="block rounded-[var(--st-radius)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent-ring)]"
              >
                <Card
                  variant="interactive"
                  padding="md"
                  className="flex h-full items-start gap-3"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                    aria-hidden="true"
                  >
                    <Icon size={16} />
                  </span>
                  <span className="flex flex-col gap-1">
                    <CardTitle className="text-[14px]">{card.title}</CardTitle>
                    <CardDescription>{card.meta}</CardDescription>
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      </HelpSection>

      {/* ----- Resources ----- */}
      <HelpSection
        title="Resources"
        description="External documentation and support are not wired up yet. The entries below are placeholders and do not go anywhere for now."
      >
        <div className="flex flex-col gap-3">
          {RESOURCES.map((resource) => {
            const Icon = resource.icon;
            return (
              <Card
                key={resource.title}
                variant="outlined"
                padding="md"
                className="flex items-center gap-3 opacity-70"
                aria-disabled="true"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                  aria-hidden="true"
                >
                  <Icon size={16} />
                </span>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-[var(--st-text)]">
                      {resource.title}
                    </span>
                    <Badge tone="neutral" kind="outline">
                      Placeholder
                    </Badge>
                  </span>
                  <span className="text-[13px] text-[var(--st-text-secondary)]">
                    {resource.meta}
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-[var(--st-text-tertiary)]"
                  aria-hidden="true"
                />
              </Card>
            );
          })}
        </div>
      </HelpSection>
    </div>
  );
}
