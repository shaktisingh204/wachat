"use client";

import * as React from "react";
import {
  ArrowRight,
  Bell,
  Briefcase,
  Calendar,
  Check,
  CircleAlert,
  CircleCheck,
  Compass,
  Copy,
  FolderOpen,
  Home as HomeIcon,
  Inbox,
  Info,
  LayoutDashboard,
  Loader2,
  Mail,
  MoreHorizontal,
  PlusCircle,
  Search,
  Settings,
  Sparkles,
  Trash2,
  User,
  Workflow,
} from "lucide-react";

import {
  ZoruAccordion,
  ZoruAccordion03,
  ZoruAccordion03Content,
  ZoruAccordion03Item,
  ZoruAccordion03Trigger,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruAlertTitle,
  ZoruAppRail,
  ZoruAppSidebar,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruBadge,
  ZoruBouncyToggle,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCheckbox,
  ZoruCommandDialog,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  ZoruCommandShortcut,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerFooter,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  ZoruDrawerTrigger,
  ZoruDropdownMenu,
  ZoruDropdownMenuCheckboxItem,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuShortcut,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruHeader,
  ZoruHeroPill,
  ZoruInput,
  ZoruKbd,
  ZoruLabel,
  ZoruLimelightNav,
  ZoruMenubar,
  ZoruMenubarContent,
  ZoruMenubarItem,
  ZoruMenubarMenu,
  ZoruMenubarSeparator,
  ZoruMenubarShortcut,
  ZoruMenubarTrigger,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPopover,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruProgress,
  ZoruRadioCard,
  ZoruRadioGroup,
  ZoruRadioGroupItem,
  ZoruScrollArea,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSeparator,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetTrigger,
  ZoruSkeleton,
  ZoruStarIcon,
  ZoruSwitch,
  ZoruTabs,
  ZoruTabsContent,
  ZoruTabsList,
  ZoruTabsListUnderline,
  ZoruTabsTrigger,
  ZoruTabsTriggerUnderline,
  ZoruTextarea,
  ZoruToaster,
  ZoruTooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  zoruToast,
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

        <Section step="Step 3" title="Hero pill + alerts">
          <div className="flex flex-wrap items-center gap-3">
            <ZoruHeroPill icon={<ZoruStarIcon />} text="New releases every week" />
            <ZoruHeroPill icon={<Sparkles className="size-3" />} text="Now in beta" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ZoruAlert variant="info">
              <Info />
              <ZoruAlertTitle>Heads up</ZoruAlertTitle>
              <ZoruAlertDescription>
                We bumped the rate limit on free plans to 1,000 requests/day.
              </ZoruAlertDescription>
            </ZoruAlert>
            <ZoruAlert variant="success">
              <CircleCheck />
              <ZoruAlertTitle>All set</ZoruAlertTitle>
              <ZoruAlertDescription>
                Your workspace is provisioned and ready to use.
              </ZoruAlertDescription>
            </ZoruAlert>
            <ZoruAlert variant="warning">
              <CircleAlert />
              <ZoruAlertTitle>Pending verification</ZoruAlertTitle>
              <ZoruAlertDescription>
                We&apos;re still verifying your business document.
              </ZoruAlertDescription>
            </ZoruAlert>
            <ZoruAlert variant="destructive">
              <CircleAlert />
              <ZoruAlertTitle>Connection failed</ZoruAlertTitle>
              <ZoruAlertDescription>
                We couldn&apos;t reach the upstream provider. Retrying…
              </ZoruAlertDescription>
            </ZoruAlert>
          </div>
        </Section>

        <Section step="Step 3" title="Dialog · Sheet · Drawer · Alert dialog">
          <div className="flex flex-wrap items-center gap-3">
            <ZoruDialog>
              <ZoruDialogTrigger asChild>
                <ZoruButton>Open dialog</ZoruButton>
              </ZoruDialogTrigger>
              <ZoruDialogContent>
                <ZoruDialogHeader>
                  <ZoruDialogTitle>Invite a teammate</ZoruDialogTitle>
                  <ZoruDialogDescription>
                    They&apos;ll get an email with a link to join your workspace.
                  </ZoruDialogDescription>
                </ZoruDialogHeader>
                <div className="space-y-2">
                  <ZoruLabel htmlFor="zoru-invite-email">Work email</ZoruLabel>
                  <ZoruInput
                    id="zoru-invite-email"
                    type="email"
                    placeholder="teammate@company.com"
                    leadingSlot={<Mail />}
                  />
                </div>
                <ZoruDialogFooter>
                  <ZoruButton variant="ghost">Cancel</ZoruButton>
                  <ZoruButton>Send invite</ZoruButton>
                </ZoruDialogFooter>
              </ZoruDialogContent>
            </ZoruDialog>

            <ZoruSheet>
              <ZoruSheetTrigger asChild>
                <ZoruButton variant="outline">Open sheet</ZoruButton>
              </ZoruSheetTrigger>
              <ZoruSheetContent side="right">
                <ZoruSheetHeader>
                  <ZoruSheetTitle>Filters</ZoruSheetTitle>
                  <ZoruSheetDescription>
                    Refine the list by status, owner, and date range.
                  </ZoruSheetDescription>
                </ZoruSheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <ZoruCheckbox id="zoru-flt-1" defaultChecked />
                    <ZoruLabel htmlFor="zoru-flt-1">Open</ZoruLabel>
                  </div>
                  <div className="flex items-center gap-3">
                    <ZoruCheckbox id="zoru-flt-2" />
                    <ZoruLabel htmlFor="zoru-flt-2">Closed</ZoruLabel>
                  </div>
                </div>
                <ZoruSheetFooter className="mt-6">
                  <ZoruButton variant="ghost">Reset</ZoruButton>
                  <ZoruButton>Apply</ZoruButton>
                </ZoruSheetFooter>
              </ZoruSheetContent>
            </ZoruSheet>

            <ZoruDrawer>
              <ZoruDrawerTrigger asChild>
                <ZoruButton variant="secondary">Open drawer</ZoruButton>
              </ZoruDrawerTrigger>
              <ZoruDrawerContent>
                <ZoruDrawerHeader>
                  <ZoruDrawerTitle>Quick actions</ZoruDrawerTitle>
                  <ZoruDrawerDescription>
                    Mobile-friendly bottom sheet powered by Vaul.
                  </ZoruDrawerDescription>
                </ZoruDrawerHeader>
                <div className="px-4 pb-2 sm:px-6">
                  <p className="text-sm text-zoru-ink-muted">
                    Drawers are perfect for actions that need a moment of focus
                    without leaving the page.
                  </p>
                </div>
                <ZoruDrawerFooter>
                  <ZoruButton>Got it</ZoruButton>
                </ZoruDrawerFooter>
              </ZoruDrawerContent>
            </ZoruDrawer>

            <ZoruAlertDialog>
              <ZoruAlertDialogTrigger asChild>
                <ZoruButton variant="destructive">Delete account</ZoruButton>
              </ZoruAlertDialogTrigger>
              <ZoruAlertDialogContent>
                <ZoruAlertDialogHeader>
                  <ZoruAlertDialogTitle>Delete account permanently?</ZoruAlertDialogTitle>
                  <ZoruAlertDialogDescription>
                    This action cannot be undone. All workspaces, contacts and
                    history will be removed.
                  </ZoruAlertDialogDescription>
                </ZoruAlertDialogHeader>
                <ZoruAlertDialogFooter>
                  <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                  <ZoruAlertDialogAction destructive>
                    Yes, delete
                  </ZoruAlertDialogAction>
                </ZoruAlertDialogFooter>
              </ZoruAlertDialogContent>
            </ZoruAlertDialog>
          </div>
        </Section>

        <Section step="Step 3" title="Popover · Dropdown · Menubar">
          <div className="flex flex-wrap items-center gap-3">
            <ZoruPopover>
              <ZoruPopoverTrigger asChild>
                <ZoruButton variant="outline">
                  <Calendar /> Schedule
                </ZoruButton>
              </ZoruPopoverTrigger>
              <ZoruPopoverContent>
                <p className="text-sm font-medium text-zoru-ink">Pick a date</p>
                <p className="mt-1 text-xs text-zoru-ink-muted">
                  Calendar primitives ship in step 5.
                </p>
              </ZoruPopoverContent>
            </ZoruPopover>

            <ZoruDropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <ZoruButton variant="outline" size="icon" aria-label="Row actions">
                  <MoreHorizontal />
                </ZoruButton>
              </ZoruDropdownMenuTrigger>
              <ZoruDropdownMenuContent align="end" className="w-52">
                <ZoruDropdownMenuLabel>Row actions</ZoruDropdownMenuLabel>
                <ZoruDropdownMenuItem>
                  <Copy /> Duplicate
                  <ZoruDropdownMenuShortcut>⌘D</ZoruDropdownMenuShortcut>
                </ZoruDropdownMenuItem>
                <ZoruDropdownMenuCheckboxItem checked>
                  Show meta
                </ZoruDropdownMenuCheckboxItem>
                <ZoruDropdownMenuCheckboxItem>
                  Group by status
                </ZoruDropdownMenuCheckboxItem>
                <ZoruDropdownMenuSeparator />
                <ZoruDropdownMenuItem destructive>
                  <Trash2 /> Delete
                  <ZoruDropdownMenuShortcut>⌫</ZoruDropdownMenuShortcut>
                </ZoruDropdownMenuItem>
              </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>

            <ZoruMenubar>
              <ZoruMenubarMenu>
                <ZoruMenubarTrigger>File</ZoruMenubarTrigger>
                <ZoruMenubarContent>
                  <ZoruMenubarItem>
                    New project
                    <ZoruMenubarShortcut>⌘N</ZoruMenubarShortcut>
                  </ZoruMenubarItem>
                  <ZoruMenubarItem>
                    Open…
                    <ZoruMenubarShortcut>⌘O</ZoruMenubarShortcut>
                  </ZoruMenubarItem>
                  <ZoruMenubarSeparator />
                  <ZoruMenubarItem>Close window</ZoruMenubarItem>
                </ZoruMenubarContent>
              </ZoruMenubarMenu>
              <ZoruMenubarMenu>
                <ZoruMenubarTrigger>Edit</ZoruMenubarTrigger>
                <ZoruMenubarContent>
                  <ZoruMenubarItem>Undo</ZoruMenubarItem>
                  <ZoruMenubarItem>Redo</ZoruMenubarItem>
                </ZoruMenubarContent>
              </ZoruMenubarMenu>
            </ZoruMenubar>
          </div>
        </Section>

        <Section step="Step 3" title="Command palette + toasts">
          <CommandAndToastDemo />
        </Section>

        <Section
          step="Step 4"
          title="Page header + breadcrumb"
          subtitle="Standard top-of-page block — eyebrow, title, description, actions."
        >
          <ZoruPageHeader>
            <ZoruPageHeading>
              <ZoruBreadcrumb>
                <ZoruBreadcrumbList>
                  <ZoruBreadcrumbItem>
                    <ZoruBreadcrumbLink href="/zoruui">ZoruUI</ZoruBreadcrumbLink>
                  </ZoruBreadcrumbItem>
                  <ZoruBreadcrumbSeparator />
                  <ZoruBreadcrumbItem>
                    <ZoruBreadcrumbPage>Layout primitives</ZoruBreadcrumbPage>
                  </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
              </ZoruBreadcrumb>
              <ZoruPageTitle>Layout primitives</ZoruPageTitle>
              <ZoruPageDescription>
                Cards, page headers, breadcrumbs, tabs, accordions, scroll areas
                and resizable panels — every layout building block needed for
                step 7 onwards.
              </ZoruPageDescription>
            </ZoruPageHeading>
            <ZoruPageActions>
              <ZoruButton variant="ghost">Export</ZoruButton>
              <ZoruButton>
                <PlusCircle /> New project
              </ZoruButton>
            </ZoruPageActions>
          </ZoruPageHeader>
        </Section>

        <Section step="Step 4" title="Cards (5 variants)">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ZoruCard>
              <ZoruCardHeader>
                <ZoruCardTitle>Default card</ZoruCardTitle>
                <ZoruCardDescription>Bordered, subtle.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <p className="text-sm text-zoru-ink-muted">
                  Quiet container for grouped content.
                </p>
              </ZoruCardContent>
            </ZoruCard>
            <ZoruCard variant="soft">
              <ZoruCardHeader>
                <ZoruCardTitle>Soft</ZoruCardTitle>
                <ZoruCardDescription>Borderless, surface tint.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <p className="text-sm text-zoru-ink-muted">Use inside dense layouts.</p>
              </ZoruCardContent>
            </ZoruCard>
            <ZoruCard variant="elevated">
              <ZoruCardHeader>
                <ZoruCardTitle>Elevated</ZoruCardTitle>
                <ZoruCardDescription>Drop shadow on idle.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <p className="text-sm text-zoru-ink-muted">Stands off the canvas.</p>
              </ZoruCardContent>
            </ZoruCard>
            <ZoruCard variant="outline">
              <ZoruCardHeader>
                <ZoruCardTitle>Outline</ZoruCardTitle>
                <ZoruCardDescription>Stronger border, no shadow.</ZoruCardDescription>
              </ZoruCardHeader>
            </ZoruCard>
            <ZoruCard interactive>
              <ZoruCardHeader>
                <ZoruCardTitle>Interactive</ZoruCardTitle>
                <ZoruCardDescription>Hover lifts the shadow.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardFooter>
                <ZoruButton variant="link">Open project →</ZoruButton>
              </ZoruCardFooter>
            </ZoruCard>
          </div>
        </Section>

        <Section step="Step 4" title="Tabs (pill + underline)">
          <ZoruTabs defaultValue="overview">
            <ZoruTabsList>
              <ZoruTabsTrigger value="overview">Overview</ZoruTabsTrigger>
              <ZoruTabsTrigger value="activity">Activity</ZoruTabsTrigger>
              <ZoruTabsTrigger value="settings">Settings</ZoruTabsTrigger>
            </ZoruTabsList>
            <ZoruTabsContent value="overview">
              <p className="text-sm text-zoru-ink-muted">
                Pill tabs — for compact, in-page section switches.
              </p>
            </ZoruTabsContent>
            <ZoruTabsContent value="activity">
              <p className="text-sm text-zoru-ink-muted">Activity feed lives here.</p>
            </ZoruTabsContent>
            <ZoruTabsContent value="settings">
              <p className="text-sm text-zoru-ink-muted">Settings form lives here.</p>
            </ZoruTabsContent>
          </ZoruTabs>

          <ZoruTabs defaultValue="all" className="mt-6">
            <ZoruTabsListUnderline>
              <ZoruTabsTriggerUnderline value="all">All</ZoruTabsTriggerUnderline>
              <ZoruTabsTriggerUnderline value="open">Open</ZoruTabsTriggerUnderline>
              <ZoruTabsTriggerUnderline value="closed">Closed</ZoruTabsTriggerUnderline>
              <ZoruTabsTriggerUnderline value="archived">
                Archived
              </ZoruTabsTriggerUnderline>
            </ZoruTabsListUnderline>
            <ZoruTabsContent value="all">
              <p className="text-sm text-zoru-ink-muted">
                Underline tabs — for module-level navigation that needs to feel
                quieter than the pill variant.
              </p>
            </ZoruTabsContent>
          </ZoruTabs>
        </Section>

        <Section step="Step 4" title="Accordion (default + boxed)">
          <div className="grid gap-6 lg:grid-cols-2">
            <ZoruAccordion type="single" collapsible>
              <ZoruAccordionItem value="a">
                <ZoruAccordionTrigger>What is ZoruUI?</ZoruAccordionTrigger>
                <ZoruAccordionContent>
                  A pure black-and-white component system parallel to the
                  existing UI — see ZORUUI_TASKS.md for the 10-step plan.
                </ZoruAccordionContent>
              </ZoruAccordionItem>
              <ZoruAccordionItem value="b">
                <ZoruAccordionTrigger>Does it replace the dock?</ZoruAccordionTrigger>
                <ZoruAccordionContent>
                  No. The existing dock is reused via re-export.
                </ZoruAccordionContent>
              </ZoruAccordionItem>
              <ZoruAccordionItem value="c">
                <ZoruAccordionTrigger>What about the multi-tab strip?</ZoruAccordionTrigger>
                <ZoruAccordionContent>
                  Removed from the new shell, by request.
                </ZoruAccordionContent>
              </ZoruAccordionItem>
            </ZoruAccordion>

            <ZoruAccordion03 type="single" collapsible className="space-y-3">
              <ZoruAccordion03Item value="a">
                <ZoruAccordion03Trigger>How do I switch a page to zoru?</ZoruAccordion03Trigger>
                <ZoruAccordion03Content>
                  Wrap the page (or layout) in <code>&lt;ZoruProvider&gt;</code>
                  and replace <code>@/components/ui/*</code> imports with
                  <code> @/components/zoruui/*</code>.
                </ZoruAccordion03Content>
              </ZoruAccordion03Item>
              <ZoruAccordion03Item value="b">
                <ZoruAccordion03Trigger>Can I keep my existing forms?</ZoruAccordion03Trigger>
                <ZoruAccordion03Content>
                  Yes — react-hook-form + zod stay. Only the input components
                  change.
                </ZoruAccordion03Content>
              </ZoruAccordion03Item>
            </ZoruAccordion03>
          </div>
        </Section>

        <Section step="Step 4" title="Scroll area + empty state + limelight">
          <div className="grid gap-6 lg:grid-cols-2">
            <ZoruCard>
              <ZoruCardHeader>
                <ZoruCardTitle>Scroll area</ZoruCardTitle>
                <ZoruCardDescription>240px tall, custom scrollbar.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <ZoruScrollArea className="h-60 rounded-[var(--zoru-radius)] border border-zoru-line p-3">
                  <ul className="space-y-2 text-sm text-zoru-ink">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <li
                        key={i}
                        className="rounded-[var(--zoru-radius-sm)] bg-zoru-surface px-3 py-2"
                      >
                        Row {i + 1}
                      </li>
                    ))}
                  </ul>
                </ZoruScrollArea>
              </ZoruCardContent>
            </ZoruCard>

            <ZoruEmptyState
              icon={<FolderOpen />}
              title="No projects yet"
              description="Create your first project to start tracking conversations and broadcasts."
              action={
                <ZoruButton>
                  <PlusCircle /> New project
                </ZoruButton>
              }
            />
          </div>

          <div className="flex justify-center">
            <ZoruLimelightNav
              items={[
                { id: "home", icon: <HomeIcon />, label: "Home" },
                { id: "explore", icon: <Compass />, label: "Explore" },
                { id: "inbox", icon: <Inbox />, label: "Inbox" },
                { id: "alerts", icon: <Bell />, label: "Alerts" },
              ]}
            />
          </div>
        </Section>

        <Section
          step="Step 4"
          title="Shell preview"
          subtitle="The composable rail + sidebar + header + dock-slot — no multi-tab strip. Step 8 wires the admin instance, step 9 the dashboard."
        >
          <div className="overflow-hidden rounded-[var(--zoru-radius-lg)] border border-zoru-line">
            <div className="flex h-[420px] w-full bg-zoru-bg">
              <ZoruAppRail
                brand={
                  <span className="flex h-8 w-8 items-center justify-center rounded-[var(--zoru-radius-sm)] bg-zoru-ink text-xs font-semibold text-zoru-on-primary">
                    Z
                  </span>
                }
                items={[
                  { id: "dash", icon: <LayoutDashboard />, label: "Dashboard", active: true },
                  { id: "flow", icon: <Workflow />, label: "Flows" },
                  { id: "crm", icon: <Briefcase />, label: "CRM" },
                  { id: "mail", icon: <Mail />, label: "Email" },
                ]}
                footer={[
                  { id: "settings", icon: <Settings />, label: "Settings" },
                ]}
              />
              <ZoruAppSidebar
                heading="Dashboard"
                caption="Overview"
                groups={[
                  {
                    id: "main",
                    label: "Main",
                    items: [
                      { id: "home", label: "Home", icon: <HomeIcon />, active: true },
                      { id: "activity", label: "Activity", icon: <Bell /> },
                      { id: "inbox", label: "Inbox", icon: <Inbox />, badge: "12" },
                    ],
                  },
                  {
                    id: "manage",
                    label: "Manage",
                    items: [
                      { id: "projects", label: "Projects", icon: <FolderOpen /> },
                      { id: "team", label: "Team", icon: <User /> },
                    ],
                  },
                ]}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <ZoruHeader
                  sticky={false}
                  leading={
                    <ZoruBreadcrumb>
                      <ZoruBreadcrumbList>
                        <ZoruBreadcrumbItem>
                          <ZoruBreadcrumbLink href="#">Dashboard</ZoruBreadcrumbLink>
                        </ZoruBreadcrumbItem>
                        <ZoruBreadcrumbSeparator />
                        <ZoruBreadcrumbItem>
                          <ZoruBreadcrumbPage>Overview</ZoruBreadcrumbPage>
                        </ZoruBreadcrumbItem>
                      </ZoruBreadcrumbList>
                    </ZoruBreadcrumb>
                  }
                  center={
                    <ZoruInput
                      placeholder="Search anything…"
                      leadingSlot={<Search />}
                      trailingSlot={<ZoruKbd>⌘K</ZoruKbd>}
                    />
                  }
                  trailing={
                    <>
                      <ZoruButton variant="ghost" size="icon" aria-label="Notifications">
                        <Bell />
                      </ZoruButton>
                      <ZoruAvatar>
                        <ZoruAvatarFallback>HK</ZoruAvatarFallback>
                      </ZoruAvatar>
                    </>
                  }
                />
                <main className="flex-1 overflow-y-auto p-6">
                  <ZoruEmptyState
                    icon={<Sparkles />}
                    title="Your shell is ready"
                    description="No multi-tab strip. The dock slot is wired but empty — step 9 will fill it in for the dashboard."
                    compact
                  />
                </main>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <ZoruToaster />
    </ZoruTooltipProvider>
  );
}

function CommandAndToastDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ZoruButton variant="outline" onClick={() => setOpen(true)}>
        <Search /> Open command palette
        <ZoruKbd>⌘K</ZoruKbd>
      </ZoruButton>
      <ZoruButton
        onClick={() =>
          zoruToast({
            title: "Saved",
            description: "Your changes are live.",
          })
        }
      >
        <Check /> Toast (default)
      </ZoruButton>
      <ZoruButton
        variant="destructive"
        onClick={() =>
          zoruToast({
            variant: "destructive",
            title: "Failed to publish",
            description: "Check the workspace status and try again.",
          })
        }
      >
        Toast (destructive)
      </ZoruButton>

      <ZoruCommandDialog open={open} onOpenChange={setOpen}>
        <ZoruCommandInput placeholder="Type a command or search…" />
        <ZoruCommandList>
          <ZoruCommandEmpty>No results found.</ZoruCommandEmpty>
          <ZoruCommandGroup heading="Quick actions">
            <ZoruCommandItem>
              <Inbox />
              Open inbox
              <ZoruCommandShortcut>⌘I</ZoruCommandShortcut>
            </ZoruCommandItem>
            <ZoruCommandItem>
              <Settings />
              Open settings
              <ZoruCommandShortcut>⌘,</ZoruCommandShortcut>
            </ZoruCommandItem>
            <ZoruCommandItem>
              <User />
              Switch workspace
            </ZoruCommandItem>
          </ZoruCommandGroup>
        </ZoruCommandList>
      </ZoruCommandDialog>
    </div>
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
