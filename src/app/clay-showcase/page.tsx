/**
 * Clay Showcase — pixel-match clone of the product reference.
 *
 * Top-level route, outside /dashboard, inherits only the root layout.
 * Visit: http://localhost:3002/clay-showcase
 */

'use client';

import * as React from 'react';
import {
  LuSearch,
  LuUserPlus,
  LuBell,
  LuEllipsis,
  LuLayoutDashboard,
  LuUsers,
  LuContact,
  LuSettings,
  LuChevronDown,
  LuCalendar,
  LuPlus,
  LuPencil,
  LuTrash2,
  LuBellDot,
  LuAlarmClock,
  LuSparkles,
  LuFilter,
  LuDownload,
  LuArrowRight,
} from 'react-icons/lu';

import {
  ClayShell,
  ClaySidebar,
  ClayTopbar,
  ClayButton,
  ClayCard,
  ClayBreadcrumbs,
  ClayRoundCard,
  ClayPromoCard,
  ClayListRow,
  ClayNotificationCard,
  ClaySectionList,
  ClayUserCard,
  ClaySelect,
  ClayAvatarStack,
} from '@/components/clay';
import { ClayInput } from '@/components/clay/clay-input';

/* ── Demo data ───────────────────────────────────────────────────── */

const candidatesRound1 = [
  { alt: 'Aisha', fallback: 'A', hue: 12 },
  { alt: 'Ben',   fallback: 'B', hue: 210 },
  { alt: 'Cam',   fallback: 'C', hue: 150 },
  { alt: 'Dina',  fallback: 'D', hue: 40 },
  { alt: 'Eli',   fallback: 'E', hue: 280 },
  { alt: 'Fin',   fallback: 'F', hue: 330 },
  { alt: 'Gio',   fallback: 'G', hue: 190 },
  { alt: 'Hanna', fallback: 'H', hue: 60 },
  { alt: 'Ivy',   fallback: 'I', hue: 120 },
  { alt: 'Jake',  fallback: 'J', hue: 0   },
];

const candidatesRound2 = [
  { alt: 'Kai',   fallback: 'K', hue: 20 },
  { alt: 'Liv',   fallback: 'L', hue: 250 },
  { alt: 'Mara',  fallback: 'M', hue: 170 },
  { alt: 'Noah',  fallback: 'N', hue: 310 },
  { alt: 'Owen',  fallback: 'O', hue: 90 },
  { alt: 'Pia',   fallback: 'P', hue: 200 },
  { alt: 'Quinn', fallback: 'Q', hue: 50 },
];

export default function ClayShowcasePage() {
  return (
    <ClayShell className="flex flex-col">
      {/* ═══════════════ TOPBAR ═══════════════ */}
      <ClayTopbar
        className="h-[72px] px-6"
        left={
          <>
            <BrandGlyph />
            <div className="ml-3 flex items-center gap-2">
              <ClayButton
                variant="pill"
                size="sm"
                leading={<LuSearch className="h-3.5 w-3.5" strokeWidth={2} />}
              >
                Search
              </ClayButton>
              <ClayButton
                variant="pill"
                size="sm"
                leading={<LuUserPlus className="h-3.5 w-3.5" strokeWidth={2} />}
              >
                Add person
              </ClayButton>
              <ClayButton
                variant="pill"
                size="sm"
                leading={<LuBell className="h-3.5 w-3.5" strokeWidth={2} />}
              >
                Notifications
              </ClayButton>
              <ClayButton variant="pill" size="icon" aria-label="More">
                <LuEllipsis className="h-4 w-4" />
              </ClayButton>
            </div>
          </>
        }
        right={
          <>
            <ClayButton
              variant="pill"
              size="sm"
              trailing={<LuChevronDown className="h-3 w-3 opacity-60" />}
            >
              En
            </ClayButton>
            <ClayButton
              variant="pill"
              size="sm"
              leading={<LuCalendar className="h-3.5 w-3.5" strokeWidth={2} />}
            >
              November 17, 2025
            </ClayButton>
            <ClayButton
              variant="obsidian"
              size="md"
              trailing={<LuChevronDown className="h-3.5 w-3.5 opacity-70" />}
              className="px-5"
            >
              Create
            </ClayButton>
          </>
        }
      />

      {/* ═══════════════ BODY ═══════════════ */}
      <div className="flex min-h-0 flex-1">
        {/* ── SIDEBAR ── */}
        <ClaySidebar
          className="w-[244px] border-r border-border px-4 pt-6"
          groupTitle="Rounds"
          groups={[
            {
              items: [
                {
                  key: 'dashboard',
                  label: 'Dashboard',
                  icon: <LuLayoutDashboard className="h-[15px] w-[15px]" strokeWidth={1.75} />,
                },
                {
                  key: 'interviews',
                  label: 'Interviews',
                  icon: <LuUsers className="h-[15px] w-[15px]" strokeWidth={1.75} />,
                },
                {
                  key: 'candidates',
                  label: 'Candidates',
                  icon: <LuContact className="h-[15px] w-[15px]" strokeWidth={1.75} />,
                  active: true,
                },
                {
                  key: 'settings',
                  label: 'Settings',
                  icon: <LuSettings className="h-[15px] w-[15px]" strokeWidth={1.75} />,
                },
              ],
            },
            {
              title: 'Departments',
              addable: true,
              items: [
                {
                  key: 'design',
                  label: 'Design Department',
                  icon: (
                    <span
                      className="h-3 w-3 rounded-[4px]"
                      style={{
                        background:
                          'linear-gradient(135deg, #C4B5FD 0%, #8B5CF6 100%)',
                      }}
                    />
                  ),
                },
                {
                  key: 'engineering',
                  label: 'Engineering Department',
                  icon: (
                    <span
                      className="h-3 w-3 rounded-[4px]"
                      style={{
                        background:
                          'linear-gradient(135deg, #FDBA74 0%, #F97316 100%)',
                      }}
                    />
                  ),
                },
              ],
            },
          ]}
          footer={
            <>
              <ClayPromoCard
                title="You're now in PRO mode!"
                description="Enjoy advanced features, extended limits, and priority tools."
                discountLabel="Discount -50%"
                discountNote="for the first month"
                ctaLabel="Explore PRO tools"
              />
              <ClayUserCard
                name="Ashley Curtin"
                email="ashleycurtin@gmail.com"
              />
            </>
          }
        />

        {/* ── MAIN ── */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1320px] px-9 pt-7 pb-8 clay-enter">
            {/* Breadcrumb */}
            <ClayBreadcrumbs
              items={[
                { label: 'Candidates', href: '#' },
                { label: 'Junior FrontEnd Developer', href: '#' },
                { label: 'Round 3' },
              ]}
            />

            {/* Page header — "Round" title + filter pills */}
            <div className="mt-5 flex items-center justify-between gap-6">
              <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">
                Round
              </h1>
              <div className="flex items-center gap-2">
                <ClayButton
                  variant="pill"
                  size="md"
                  trailing={<LuChevronDown className="h-3 w-3 opacity-60" />}
                >
                  All Departments
                </ClayButton>
                <ClayButton
                  variant="pill"
                  size="md"
                  leading={<LuDownload className="h-3.5 w-3.5" strokeWidth={2} />}
                >
                  Export
                </ClayButton>
                <ClayButton
                  variant="pill"
                  size="md"
                  leading={<LuFilter className="h-3.5 w-3.5" strokeWidth={2} />}
                >
                  Filter
                </ClayButton>
              </div>
            </div>

            {/* ── Round cards row ── */}
            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_280px]">
              <ClayRoundCard
                title="Round 1"
                subtitle="Initial Review"
                dateRange="June 12 – June 15"
                candidateCount={10}
                status="completed"
                candidates={candidatesRound1}
              />
              <ClayRoundCard
                title="Round 2"
                subtitle="Initial Review"
                dateRange="June 12 – June 15"
                candidateCount={10}
                status="in-progress"
                candidates={candidatesRound2}
              />

              {/* Notifications column */}
              <div className="flex flex-col gap-2">
                <ClayNotificationCard
                  icon={<LuSparkles className="h-3.5 w-3.5" strokeWidth={2} />}
                  title="PRO mode activated"
                />
                <ClayNotificationCard
                  icon={<LuUserPlus className="h-3.5 w-3.5" strokeWidth={2} />}
                  title="New candidate added"
                />
                <ClayNotificationCard
                  icon={<LuAlarmClock className="h-3.5 w-3.5" strokeWidth={2} />}
                  title="Phase deadline soon"
                  tone="obsidian"
                />
                <button
                  type="button"
                  className="mt-1.5 flex items-center justify-between px-2 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>See all notifications</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    <LuBellDot className="h-2.5 w-2.5" strokeWidth={2} />
                    News
                  </span>
                </button>
              </div>
            </div>

            {/* ── Interview Overview grid ── */}
            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              {/* LEFT — Interview Overview card */}
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-[22px] font-semibold tracking-tight text-foreground leading-none">
                    Interview Overview
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <ClayButton variant="pill" size="icon" aria-label="Add">
                      <LuPlus className="h-4 w-4" />
                    </ClayButton>
                    <ClayButton variant="pill" size="icon" aria-label="More">
                      <LuEllipsis className="h-4 w-4" />
                    </ClayButton>
                  </div>
                </div>

                <ClayCard padded={false} className="mt-5 p-6">
                  <div className="text-[14px] font-semibold text-foreground">
                    Previous Background
                  </div>

                  <div className="mt-4 flex flex-col gap-3">
                    {/* Row 1 — collapsed */}
                    <ClayListRow
                      index={1}
                      title="In what ways do JavaScript and jQuery vary?"
                      meta="3m · 4 Questions"
                      trailing={
                        <>
                          <button
                            type="button"
                            aria-label="Edit"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <LuPencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          >
                            <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                        </>
                      }
                    />

                    {/* Row 2 — expanded (Editing) */}
                    <ClayListRow index={2} title="Editing" expanded>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.5fr_1fr_0.7fr_0.8fr]">
                        <FormField label="Prompt">
                          <ClayInput
                            sizeVariant="md"
                            defaultValue="How are JavaScript and jQuery different?"
                          />
                        </FormField>
                        <FormField label="Competencies">
                          <ClaySelect
                            sizeVariant="md"
                            options={[
                              { value: 'teambuilding', label: 'Teambuilding' },
                              { value: 'leadership', label: 'Leadership' },
                              { value: 'problem-solving', label: 'Problem solving' },
                            ]}
                          />
                        </FormField>
                        <FormField label="Time">
                          <ClaySelect
                            sizeVariant="md"
                            defaultValue="10"
                            options={[
                              { value: '5', label: '5 m' },
                              { value: '10', label: '10 m' },
                              { value: '15', label: '15 m' },
                              { value: '30', label: '30 m' },
                            ]}
                          />
                        </FormField>
                        <FormField label="Level">
                          <ClaySelect
                            sizeVariant="md"
                            options={[
                              { value: 'pending', label: 'Pending' },
                              { value: 'junior', label: 'Junior' },
                              { value: 'mid', label: 'Mid' },
                              { value: 'senior', label: 'Senior' },
                            ]}
                          />
                        </FormField>
                      </div>

                      {/* Guidelines */}
                      <div className="mt-5 rounded-lg border border-border bg-secondary p-4">
                        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Guidelines
                        </div>
                        <div className="mt-1.5 text-[13px] font-semibold text-foreground leading-snug">
                          Some of the key features of design are:
                        </div>
                        <ul className="mt-2 space-y-1.5 text-[12.5px] leading-[1.55] text-muted-foreground">
                          <li className="flex gap-2">
                            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                            <span>
                              A line is a visual trace created by any writing tool or the
                              meeting point of two shapes
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                            <span>
                              Size refers to how much actual space some element occupies
                              compared to other elements
                            </span>
                          </li>
                        </ul>
                      </div>

                      {/* Actions */}
                      <div className="mt-5 flex items-center justify-end gap-2">
                        <ClayButton variant="pill" size="md">
                          Insert From Library
                        </ClayButton>
                        <ClayButton variant="rose" size="md">
                          Create New Prompt
                        </ClayButton>
                      </div>
                    </ClayListRow>
                  </div>
                </ClayCard>
              </div>

              {/* RIGHT rail */}
              <div className="flex flex-col gap-5">
                {/* Assigned Interviewers */}
                <ClayCard padded={false} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-foreground leading-tight">
                        Assigned Interviewers
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground leading-tight">
                        Interview Panel for This Position
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Open panel"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <LuArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                  <ClayAvatarStack
                    className="mt-3"
                    size="sm"
                    max={4}
                    overflowTone="rose"
                    items={[
                      { alt: 'Ira', fallback: 'I', hue: 20 },
                      { alt: 'Jun', fallback: 'J', hue: 200 },
                      { alt: 'Kim', fallback: 'K', hue: 140 },
                      { alt: 'Leo', fallback: 'L', hue: 330 },
                      { alt: 'Mei', fallback: 'M', hue: 60 },
                      { alt: 'Nia', fallback: 'N', hue: 280 },
                    ]}
                  />
                </ClayCard>

                {/* Sections */}
                <div>
                  <div className="flex items-center justify-between px-0.5 pb-3">
                    <h3 className="text-[15px] font-semibold text-foreground">
                      Sections
                    </h3>
                    <ClayButton
                      variant="pill"
                      size="sm"
                      leading={<LuPlus className="h-3 w-3" strokeWidth={2.25} />}
                    >
                      Add Section
                    </ClayButton>
                  </div>
                  <ClaySectionList
                    items={[
                      { key: 'intro',     title: 'Introduction',     meta: '3m · 4 Questions' },
                      { key: 'portfolio', title: 'Portfolio Review', meta: '5m · 6 Questions' },
                      { key: 'bg',        title: 'Background Check', meta: '4m · 5 Questions' },
                      { key: 'skills',    title: 'Skill Assessment', meta: '6m · 8 Questions' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Bottom spacer */}
            <div className="h-8" />
          </div>
        </main>
      </div>
    </ClayShell>
  );
}

/* ── helpers ──────────────────────────────────────────────────────── */

function BrandGlyph() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-sm">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-foreground"
        aria-hidden
      >
        <path d="M3 3v10h3" />
        <path d="M3 3h10v4a2 2 0 0 1-2 2H8" />
        <path d="M13 13H8a2 2 0 0 1-2-2V9" />
      </svg>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
