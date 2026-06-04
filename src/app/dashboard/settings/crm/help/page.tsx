/**
 * SabCRM — Help & Keyboard Shortcuts settings (`/dashboard/settings/crm/help`).
 *
 * A fully static, Twenty-style reference page. There is no data fetching and
 * no interactivity, so this stays a server component (no `'use client'`).
 *
 * Three scannable sections:
 *
 *   1. Keyboard shortcuts — a reference table grouped by area (Global, Table,
 *      Record). Keys render as `<kbd class="st-kbd">` chips, alternative keys
 *      joined by a small "or".
 *
 *   2. Getting started — link cards into the key SabCRM settings areas
 *      (Data model, Members, Import & export, Workflows).
 *
 *   3. Resources — documentation / support links. These are honest
 *      placeholders: the external help destinations aren't wired up yet, so
 *      each is tagged "Placeholder" and points at `#`.
 *
 * Shared `.st-*` styling comes from `sabcrm-twenty.css`; the help-only layout
 * classes live in the sibling `help.css`.
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

import { TwentyPageHeader } from '@/components/sabcrm/twenty';

import '@/styles/sabcrm-twenty.css';
import '../settings-twenty.css';
import './help.css';

// ---------------------------------------------------------------------------
// Shortcut data
// ---------------------------------------------------------------------------

/** A single shortcut row: one or more key sequences plus what it does. */
interface Shortcut {
  /** Each entry is a chord rendered as one `<kbd>`; multiple = alternatives. */
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
// Resource links (placeholders — external help isn't wired up yet)
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
    <span className="st-shortcut-keys">
      {keys.map((key, i) => (
        <React.Fragment key={key}>
          {i > 0 ? (
            <span className="st-shortcut-keys__sep" aria-hidden="true">
              or
            </span>
          ) : null}
          <kbd className="st-kbd">{key}</kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmHelpSettingsPage(): React.JSX.Element {
  return (
    <div className="st-page">
      <div className="st-settings">
        <TwentyPageHeader title="Help & Shortcuts" icon={HelpCircle} />
        <p className="st-settings__intro">
          A quick reference for moving around SabCRM faster — keyboard
          shortcuts, jumping-off points for setup, and where to find more help.
        </p>

        {/* ----- Keyboard shortcuts ----- */}
        <section className="st-help-section">
          <div className="st-help-section__head">
            <h2 className="st-help-section__title">Keyboard shortcuts</h2>
            <p className="st-help-section__desc">
              Most actions have a shortcut. Press{' '}
              <kbd className="st-kbd">?</kbd> anywhere to bring this list up
              without leaving what you&apos;re doing.
            </p>
          </div>

          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label} className="st-shortcut-group">
              <h3 className="st-shortcut-group__label">{group.label}</h3>
              <div className="st-table-wrap">
                <table className="st-shortcut-table">
                  <tbody>
                    {group.shortcuts.map((shortcut) => (
                      <tr key={shortcut.description}>
                        <td className="st-shortcut-table__keys">
                          <ShortcutKeys keys={shortcut.keys} />
                        </td>
                        <td className="st-shortcut-table__desc">
                          {shortcut.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>

        {/* ----- Getting started ----- */}
        <section className="st-help-section">
          <div className="st-help-section__head">
            <h2 className="st-help-section__title">Getting started</h2>
            <p className="st-help-section__desc">
              New here, or setting up a fresh workspace? These are the areas
              most teams configure first.
            </p>
          </div>

          <div className="st-help-grid">
            {START_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href} className="st-card st-help-card">
                  <span className="st-help-card__icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span className="st-help-card__body">
                    <span className="st-help-card__title">{card.title}</span>
                    <span className="st-help-card__meta">{card.meta}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ----- Resources ----- */}
        <section className="st-help-section">
          <div className="st-help-section__head">
            <h2 className="st-help-section__title">Resources</h2>
            <p className="st-help-section__desc">
              External documentation and support aren&apos;t wired up yet — the
              links below are placeholders and don&apos;t go anywhere for now.
            </p>
          </div>

          <div className="st-resource-list">
            {RESOURCES.map((resource) => {
              const Icon = resource.icon;
              return (
                <div key={resource.title} className="st-resource-row" aria-disabled="true">
                  <span className="st-resource-row__icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span className="st-resource-row__body">
                    <span className="st-resource-row__title">
                      {resource.title}
                      <span className="st-placeholder-tag">Placeholder</span>
                    </span>
                    <span className="st-resource-row__meta">{resource.meta}</span>
                  </span>
                  <ChevronRight
                    className="st-resource-row__arrow"
                    size={16}
                    aria-hidden="true"
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
