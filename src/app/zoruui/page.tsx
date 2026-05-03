import { ArrowRight, Loader2, Mail, Search, Settings, User } from "lucide-react";

import {
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruBadge,
  ZoruBouncyToggle,
  ZoruButton,
  ZoruCheckbox,
  ZoruInput,
  ZoruKbd,
  ZoruLabel,
  ZoruProgress,
  ZoruRadioCard,
  ZoruRadioGroup,
  ZoruRadioGroupItem,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSeparator,
  ZoruSkeleton,
  ZoruSwitch,
  ZoruTextarea,
  ZoruTooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
} from "@/components/zoruui";

export default function ZoruuiGalleryPage() {
  return (
    <ZoruTooltipProvider delayDuration={150}>
      <div className="mx-auto max-w-5xl px-8 py-16">
        <Header />

        <Section
          step="Step 1"
          title="Foundation"
          subtitle="Tokens scoped under .zoruui — black ink, neutral surfaces, no dark mode."
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <SwatchCard label="bg" varName="--zoru-bg" />
            <SwatchCard label="surface" varName="--zoru-surface" />
            <SwatchCard label="surface-2" varName="--zoru-surface-2" />
            <SwatchCard label="line" varName="--zoru-line" />
            <SwatchCard label="ink-muted" varName="--zoru-ink-muted" />
            <SwatchCard label="ink (primary)" varName="--zoru-ink" />
          </div>
        </Section>

        <Section step="Step 2" title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <ZoruButton>Primary</ZoruButton>
            <ZoruButton variant="secondary">Secondary</ZoruButton>
            <ZoruButton variant="outline">Outline</ZoruButton>
            <ZoruButton variant="ghost">Ghost</ZoruButton>
            <ZoruButton variant="link">Link</ZoruButton>
            <ZoruButton variant="destructive">Delete</ZoruButton>
            <ZoruButton variant="success">Success</ZoruButton>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ZoruButton size="sm">Small</ZoruButton>
            <ZoruButton size="md">Medium</ZoruButton>
            <ZoruButton size="lg">Large</ZoruButton>
            <ZoruButton size="icon" aria-label="Settings">
              <Settings />
            </ZoruButton>
            <ZoruButton disabled>
              <Loader2 className="animate-spin" /> Loading
            </ZoruButton>
            <ZoruButton>
              Continue <ArrowRight />
            </ZoruButton>
          </div>
        </Section>

        <Section step="Step 2" title="Text inputs">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="zoru-demo-email">
              <ZoruInput
                id="zoru-demo-email"
                type="email"
                placeholder="you@company.com"
                leadingSlot={<Mail />}
              />
            </Field>
            <Field label="Search" htmlFor="zoru-demo-search">
              <ZoruInput
                id="zoru-demo-search"
                placeholder="Search anything…"
                leadingSlot={<Search />}
                trailingSlot={<ZoruKbd>⌘K</ZoruKbd>}
              />
            </Field>
            <Field label="Disabled" htmlFor="zoru-demo-disabled">
              <ZoruInput id="zoru-demo-disabled" disabled defaultValue="read only" />
            </Field>
            <Field label="Invalid" htmlFor="zoru-demo-invalid">
              <ZoruInput id="zoru-demo-invalid" invalid defaultValue="bad value" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Message" htmlFor="zoru-demo-textarea">
                <ZoruTextarea
                  id="zoru-demo-textarea"
                  placeholder="Type your message here…"
                  rows={4}
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section step="Step 2" title="Choice controls">
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-4">
              <p className="text-sm font-medium text-zoru-ink">Checkboxes</p>
              <div className="flex items-center gap-3">
                <ZoruCheckbox id="zoru-cb-1" defaultChecked />
                <ZoruLabel htmlFor="zoru-cb-1">Receive product updates</ZoruLabel>
              </div>
              <div className="flex items-center gap-3">
                <ZoruCheckbox id="zoru-cb-2" />
                <ZoruLabel htmlFor="zoru-cb-2">Subscribe to changelog</ZoruLabel>
              </div>
              <div className="flex items-center gap-3">
                <ZoruCheckbox id="zoru-cb-3" disabled />
                <ZoruLabel htmlFor="zoru-cb-3">Disabled option</ZoruLabel>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-sm font-medium text-zoru-ink">Switches</p>
              <div className="flex items-center gap-3">
                <ZoruSwitch id="zoru-sw-1" defaultChecked />
                <ZoruLabel htmlFor="zoru-sw-1">Enable notifications</ZoruLabel>
              </div>
              <div className="flex items-center gap-3">
                <ZoruSwitch id="zoru-sw-2" />
                <ZoruLabel htmlFor="zoru-sw-2">Auto-archive replies</ZoruLabel>
              </div>
              <ZoruBouncyToggle label="Marketing emails" defaultChecked />
            </div>
          </div>
        </Section>

        <Section step="Step 2" title="Radio group + cards">
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-zoru-ink">Inline</p>
              <ZoruRadioGroup defaultValue="monthly">
                <div className="flex items-center gap-3">
                  <ZoruRadioGroupItem value="monthly" id="zoru-r-1" />
                  <ZoruLabel htmlFor="zoru-r-1">Monthly</ZoruLabel>
                </div>
                <div className="flex items-center gap-3">
                  <ZoruRadioGroupItem value="yearly" id="zoru-r-2" />
                  <ZoruLabel htmlFor="zoru-r-2">Yearly</ZoruLabel>
                </div>
              </ZoruRadioGroup>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-zoru-ink">Cards</p>
              <ZoruRadioGroup defaultValue="pro">
                <ZoruRadioCard
                  value="starter"
                  label="Starter"
                  description="Up to 1 000 contacts."
                />
                <ZoruRadioCard
                  value="pro"
                  label="Pro"
                  description="Unlimited contacts and live agents."
                />
              </ZoruRadioGroup>
            </div>
          </div>
        </Section>

        <Section step="Step 2" title="Select">
          <div className="max-w-xs">
            <Field label="Region" htmlFor="zoru-select-region">
              <ZoruSelect>
                <ZoruSelectTrigger id="zoru-select-region">
                  <ZoruSelectValue placeholder="Choose a region…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="us-east">US East (N. Virginia)</ZoruSelectItem>
                  <ZoruSelectItem value="us-west">US West (Oregon)</ZoruSelectItem>
                  <ZoruSelectItem value="eu-west">EU West (Ireland)</ZoruSelectItem>
                  <ZoruSelectItem value="ap-south">AP South (Mumbai)</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </Field>
          </div>
        </Section>

        <Section step="Step 2" title="Display, badges, progress, skeleton">
          <div className="flex flex-wrap items-center gap-2">
            <ZoruBadge>Default</ZoruBadge>
            <ZoruBadge variant="secondary">Secondary</ZoruBadge>
            <ZoruBadge variant="outline">Outline</ZoruBadge>
            <ZoruBadge variant="ghost">Ghost</ZoruBadge>
            <ZoruBadge variant="success">Active</ZoruBadge>
            <ZoruBadge variant="danger">Failed</ZoruBadge>
            <ZoruBadge variant="warning">Pending</ZoruBadge>
            <ZoruBadge variant="info">Info</ZoruBadge>
          </div>
          <ZoruSeparator />
          <div className="flex items-center gap-4">
            <ZoruAvatar>
              <ZoruAvatarImage src="https://i.pravatar.cc/96?img=12" alt="Avatar" />
              <ZoruAvatarFallback>HK</ZoruAvatarFallback>
            </ZoruAvatar>
            <ZoruAvatar>
              <ZoruAvatarFallback>
                <User className="h-4 w-4" />
              </ZoruAvatarFallback>
            </ZoruAvatar>
            <ZoruTooltip>
              <ZoruTooltipTrigger asChild>
                <ZoruButton variant="outline" size="icon" aria-label="Help">
                  <Settings />
                </ZoruButton>
              </ZoruTooltipTrigger>
              <ZoruTooltipContent>Open settings</ZoruTooltipContent>
            </ZoruTooltip>
            <ZoruKbd>⌘</ZoruKbd>
            <ZoruKbd>⇧</ZoruKbd>
            <ZoruKbd>P</ZoruKbd>
          </div>
          <div className="space-y-3">
            <ZoruProgress value={32} />
            <ZoruProgress value={68} />
            <ZoruProgress value={94} />
          </div>
          <div className="space-y-2">
            <ZoruSkeleton className="h-4 w-2/3" />
            <ZoruSkeleton className="h-4 w-1/2" />
            <ZoruSkeleton className="h-4 w-3/4" />
          </div>
        </Section>
      </div>
    </ZoruTooltipProvider>
  );
}

function Header() {
  return (
    <header className="border-b border-zoru-line pb-10">
      <p className="text-xs uppercase tracking-[0.2em] text-zoru-ink-muted">
        ZoruUI · Steps 1–2 of 10
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zoru-ink">
        Foundation + atoms.
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-zoru-ink-muted">
        Tokens, scope, dock re-export, and the form & text primitives.
        Overlays, layout, data, and marketing primitives ship in the
        next four steps.
      </p>
    </header>
  );
}

function Section({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16 space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-zoru-ink-subtle">
          {step}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-zoru-ink">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-sm text-zoru-ink-muted">{subtitle}</p>
        )}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <ZoruLabel htmlFor={htmlFor}>{label}</ZoruLabel>
      {children}
    </div>
  );
}

function SwatchCard({ label, varName }: { label: string; varName: string }) {
  return (
    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-4">
      <div
        className="h-16 w-full rounded-[var(--zoru-radius-sm)] border border-zoru-line"
        style={{ backgroundColor: `hsl(var(${varName}))` }}
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-medium text-zoru-ink">{label}</span>
        <code className="text-[11px] text-zoru-ink-muted">{varName}</code>
      </div>
    </div>
  );
}
