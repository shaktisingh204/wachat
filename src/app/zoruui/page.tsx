"use client";

import * as React from "react";
import {
  ArrowRight,
  Activity,
  Bell,
  BookOpen,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Heart,
  Lightbulb,
  Shield,
  Zap,
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
  ZORU_CHART_PALETTE,
  ZoruAccordion,
  ZoruAccordion03,
  ZoruAccordion03Content,
  ZoruAccordion03Item,
  ZoruAccordion03Trigger,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruActionSearchBar,
  ZoruAlert,
  ZoruAppSidebar,
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
  ZoruCallToAction,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCalendar,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCarousel,
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZoruColorPicker,
  ZoruDatePicker,
  ZoruDateRangePicker,
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
  ZoruFeatureCard,
  ZoruFeatureGrid,
  ZoruFileUploadCard,
  ZoruFilesPage,
  ZoruFullscreenCalendar,
  ZoruHeader,
  ZoruHeroPill,
  ZoruInput,
  ZoruJobListing,
  ZoruLogos3,
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
  ZoruPricingCard,
  ZoruPricingTier,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  ZoruProgress,
  ZoruRadioCard,
  ZoruRadioGroup,
  ZoruRadioGroupItem,
  ZoruScrollArea,
  ZoruTestimonialsColumns,
  ZoruUserDropdown,
  ZoruWaterLoader,
  ZoruSelect,
  ZoruStatCard,
  ZoruStatisticsCard1,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSeparator,
  ZoruTableWithDialog,
  ZoruDataTable,
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
          subtitle="Sidebar + header + dock — no vertical app rail (apps live in the dock now), no multi-tab strip. Step 8 wires the admin instance, step 9 the dashboard."
        >
          <div className="overflow-hidden rounded-[var(--zoru-radius-lg)] border border-zoru-line">
            <div className="flex h-[420px] w-full bg-zoru-bg">
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

        <Section step="Step 5" title="Stat cards + chart">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ZoruStatCard
              label="Active conversations"
              value="12,840"
              delta={4.2}
              period="vs last week"
              icon={<Activity />}
            />
            <ZoruStatCard
              label="Delivered"
              value="98.4%"
              delta={0.6}
              period="last 24h"
              icon={<CheckCircle2 />}
            />
            <ZoruStatCard
              label="Failed"
              value="0.7%"
              delta={-0.2}
              period="last 24h"
              invertDelta
              icon={<CircleAlert />}
            />
            <ZoruStatCard
              label="Avg. response"
              value="42s"
              delta={-8.4}
              period="last 7d"
              invertDelta
              icon={<Calendar />}
            />
          </div>

          <ZoruStatisticsCard1
            headline="Workspace overview"
            value="48,201"
            icon={<Activity />}
            items={[
              { label: "New", value: "1,204", delta: 6.2 },
              { label: "Returning", value: "31,870", delta: 1.8 },
              { label: "Churned", value: "412", delta: -2.4 },
            ]}
            footer="Last refreshed just now"
          />

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Messages per day</ZoruCardTitle>
              <ZoruCardDescription>
                Pure neutral palette — separation by stroke shape, not hue.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
              <ZoruChartContainer height={240}>
                <ZoruChart.LineChart data={CHART_DATA}>
                  <ZoruChart.CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--zoru-line))"
                  />
                  <ZoruChart.XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "hsl(var(--zoru-ink-muted))" }}
                    tickLine={false}
                    axisLine={{ stroke: "hsl(var(--zoru-line))" }}
                  />
                  <ZoruChart.YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--zoru-ink-muted))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ZoruChart.Tooltip content={<ZoruChartTooltip />} />
                  <ZoruChart.Line
                    type="monotone"
                    dataKey="sent"
                    name="Sent"
                    stroke={ZORU_CHART_PALETTE[0]}
                    strokeWidth={2}
                    dot={false}
                  />
                  <ZoruChart.Line
                    type="monotone"
                    dataKey="delivered"
                    name="Delivered"
                    stroke={ZORU_CHART_PALETTE[2]}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ZoruChart.LineChart>
              </ZoruChartContainer>
            </ZoruCardContent>
          </ZoruCard>
        </Section>

        <Section
          step="Step 5"
          title="Tables — basic, click-to-dialog, data-table"
        >
          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Click a row to open the dialog</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
              <ZoruTableWithDialog
                rows={ROWS}
                columns={[
                  { key: "name", header: "Name" },
                  { key: "owner", header: "Owner" },
                  {
                    key: "status",
                    header: "Status",
                    cell: (r) => (
                      <ZoruBadge variant={r.status === "Active" ? "success" : "ghost"}>
                        {r.status}
                      </ZoruBadge>
                    ),
                  },
                  { key: "updated", header: "Updated", align: "right" },
                ]}
                rowTitle={(r) => r.name}
                rowDescription={(r) => `Owned by ${r.owner}`}
                rowDialog={(r) => (
                  <p className="text-sm text-zoru-ink-muted">
                    Replace this body with the row detail editor for{" "}
                    <span className="font-medium text-zoru-ink">{r.name}</span>.
                  </p>
                )}
              />
            </ZoruCardContent>
          </ZoruCard>

          <ZoruCard>
            <ZoruCardHeader>
              <ZoruCardTitle>Tanstack data-table</ZoruCardTitle>
              <ZoruCardDescription>
                Sort, filter, paginate, toggle columns.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
              <ZoruDataTable
                columns={DATA_TABLE_COLUMNS}
                data={DATA_TABLE_ROWS}
                filterColumn="name"
                filterPlaceholder="Filter by name…"
                pageSize={5}
              />
            </ZoruCardContent>
          </ZoruCard>
        </Section>

        <Section step="Step 5" title="Dates: picker, range, calendar, fullscreen">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DemoDatePicker />
            <DemoDateRange />
            <ZoruCard>
              <ZoruCardContent className="pt-6">
                <ZoruCalendar mode="single" />
              </ZoruCardContent>
            </ZoruCard>
          </div>
          <div className="h-[480px]">
            <ZoruFullscreenCalendar
              events={CALENDAR_EVENTS}
            />
          </div>
        </Section>

        <Section step="Step 5" title="File upload + files module">
          <div className="grid gap-4 lg:grid-cols-2">
            <ZoruCard>
              <ZoruCardHeader>
                <ZoruCardTitle>Drop zone</ZoruCardTitle>
              </ZoruCardHeader>
              <ZoruCardContent>
                <ZoruFileUploadCard
                  hint="PNG, JPG, PDF up to 5 MB"
                  maxSize={5 * 1024 * 1024}
                  items={[
                    {
                      id: "u1",
                      file: new File([""], "brand-deck.pdf"),
                      progress: 64,
                      status: "uploading",
                    },
                    {
                      id: "u2",
                      file: new File([""], "logo-final.svg"),
                      progress: 100,
                      status: "done",
                    },
                  ]}
                />
              </ZoruCardContent>
            </ZoruCard>
            <ZoruCard>
              <ZoruCardHeader>
                <ZoruCardTitle>Files page (composed)</ZoruCardTitle>
                <ZoruCardDescription>
                  Toolbar + grid + 5 dialogs in one drop-in.
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <ZoruFilesPage files={SAMPLE_FILES} onUpload={() => {}} onRename={() => {}} onDelete={() => {}} />
              </ZoruCardContent>
            </ZoruCard>
          </div>
        </Section>

        <Section step="Step 6" title="Action search bar + user dropdown + water loader">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <ZoruActionSearchBar
              actions={[
                { id: "new-project", label: "Create new project", icon: <PlusCircle />, shortcut: <ZoruKbd>N</ZoruKbd> },
                { id: "invite", label: "Invite teammate", icon: <User />, shortcut: <ZoruKbd>I</ZoruKbd> },
                { id: "settings", label: "Open settings", icon: <Settings />, shortcut: <ZoruKbd>,</ZoruKbd> },
                { id: "docs", label: "Read the docs", icon: <BookOpen /> },
              ]}
            />
            <ZoruUserDropdown
              name="Harsh Khandelwal"
              email="harsh@sabnode.com"
            />
            <ZoruWaterLoader label="Loading…" />
          </div>
        </Section>

        <Section step="Step 6" title="Logos strip + testimonials wall">
          <ZoruLogos3
            heading="Trusted by 8,000+ businesses"
            logos={[
              { id: "1", description: "Acme", image: "https://placehold.co/120x40?text=ACME" },
              { id: "2", description: "Globex", image: "https://placehold.co/120x40?text=GLOBEX" },
              { id: "3", description: "Initech", image: "https://placehold.co/120x40?text=INITECH" },
              { id: "4", description: "Soylent", image: "https://placehold.co/120x40?text=SOYLENT" },
              { id: "5", description: "Umbrella", image: "https://placehold.co/120x40?text=UMBRELLA" },
              { id: "6", description: "Wonka", image: "https://placehold.co/120x40?text=WONKA" },
            ]}
          />

          <ZoruTestimonialsColumns
            testimonials={TESTIMONIALS}
            columnCount={3}
            height={520}
          />
        </Section>

        <Section step="Step 6" title="Feature grid + pricing tier">
          <ZoruFeatureGrid
            heading="Everything you need to ship"
            subhead="Each surface speaks the same language — calm, neutral, focused."
            columns={3}
          >
            <ZoruFeatureCard
              icon={<Zap />}
              title="Fast by default"
              description="Server Components, Cache Components, and Fluid Compute under the hood."
            />
            <ZoruFeatureCard
              icon={<Shield />}
              title="Secure"
              description="Plan-gated, RBAC-guarded, audit-logged from day one."
            />
            <ZoruFeatureCard
              icon={<Lightbulb />}
              title="Composable"
              description="One vocabulary across Wachat, SabFlow, CRM, SEO, and SabChat."
            />
          </ZoruFeatureGrid>

          <ZoruPricingTier
            heading="Pick a plan that fits"
            subhead="Pricing in zoru is delivered with a heavy dose of restraint."
          >
            <ZoruPricingCard
              name="Starter"
              tagline="For a small team taking it for a spin."
              price="$29"
              period="/ month"
              cta={
                <ZoruButton variant="outline" block>
                  Start free
                </ZoruButton>
              }
              features={[
                { label: "1,000 contacts" },
                { label: "Email + WhatsApp inbox" },
                { label: "Basic automations" },
              ]}
            />
            <ZoruPricingCard
              name="Pro"
              tagline="For teams that ship every week."
              price="$99"
              period="/ month"
              featured
              cta={
                <ZoruButton block className="bg-zoru-on-primary text-zoru-ink hover:bg-zoru-on-primary/90">
                  Choose Pro
                </ZoruButton>
              }
              features={[
                { label: "Unlimited contacts" },
                { label: "Live agents + routing" },
                { label: "Workflow builder" },
                { label: "Priority support" },
              ]}
            />
            <ZoruPricingCard
              name="Enterprise"
              tagline="For complex orgs with real compliance asks."
              price="Custom"
              cta={
                <ZoruButton variant="outline" block>
                  Talk to sales
                </ZoruButton>
              }
              features={[
                { label: "SAML SSO + audit log" },
                { label: "Dedicated CSM" },
                { label: "On-prem option" },
              ]}
            />
          </ZoruPricingTier>
        </Section>

        <Section step="Step 6" title="Job listing + call-to-action">
          <ZoruJobListing
            jobs={[
              {
                id: "j1",
                company: "SabNode",
                title: "Senior frontend engineer",
                logo: <Briefcase />,
                description:
                  "Lead the zoruui rollout across all modules and own the design-system roadmap.",
                salary: "$160k – $200k",
                location: "Remote (IN, US)",
                remote: "Remote",
                schedule: "Full-time",
              },
              {
                id: "j2",
                company: "SabNode",
                title: "Backend engineer (Node)",
                logo: <Heart />,
                description:
                  "Own the SabFlow runtime — long-running, durable workflow orchestration.",
                salary: "$140k – $180k",
                location: "Remote (worldwide)",
                remote: "Remote",
                schedule: "Full-time",
              },
            ]}
          />

          <ZoruCallToAction
            variant="inverted"
            eyebrow="Ready when you are"
            title="Bring your team to ZoruUI."
            description="Every primitive is in place. Steps 7–10 wire the existing modules onto the new shell."
            actions={
              <>
                <ZoruButton className="bg-zoru-on-primary text-zoru-ink hover:bg-zoru-on-primary/90">
                  Start the migration
                </ZoruButton>
                <ZoruButton variant="ghost" className="text-zoru-on-primary hover:bg-zoru-on-primary/10">
                  Read the plan →
                </ZoruButton>
              </>
            }
          />
        </Section>

        <Section step="Step 5" title="Carousel + color picker">
          <ZoruCarousel className="px-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <ZoruCard
                key={i}
                className="w-72 shrink-0"
                variant="elevated"
              >
                <ZoruCardHeader>
                  <ZoruCardTitle>Slide {i + 1}</ZoruCardTitle>
                  <ZoruCardDescription>
                    CSS-snap carousel — zero deps.
                  </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                  <ZoruSkeleton className="h-24 w-full" />
                </ZoruCardContent>
              </ZoruCard>
            ))}
          </ZoruCarousel>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zoru-ink-muted">Brand colour:</span>
            <ZoruColorPicker value="#0F0F10" />
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

function DemoDatePicker() {
  const [date, setDate] = React.useState<Date | undefined>();
  return (
    <ZoruCard>
      <ZoruCardHeader>
        <ZoruCardTitle>Date picker</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent>
        <ZoruDatePicker value={date} onChange={setDate} />
      </ZoruCardContent>
    </ZoruCard>
  );
}

function DemoDateRange() {
  const [range, setRange] = React.useState<
    import("react-day-picker").DateRange | undefined
  >();
  return (
    <ZoruCard>
      <ZoruCardHeader>
        <ZoruCardTitle>Date range picker</ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruCardContent>
        <ZoruDateRangePicker value={range} onChange={setRange} numberOfMonths={1} />
      </ZoruCardContent>
    </ZoruCard>
  );
}

const ROWS = [
  { name: "Pricing-page redesign", owner: "Aria Patel", status: "Active", updated: "2h ago" },
  { name: "Onboarding flow", owner: "Sam Chen", status: "Paused", updated: "1d ago" },
  { name: "Q3 announcement", owner: "Lin Wu", status: "Active", updated: "4d ago" },
];

interface DataRow {
  id: string;
  name: string;
  email: string;
  role: string;
  joined: string;
}

const DATA_TABLE_ROWS: DataRow[] = Array.from({ length: 18 }).map((_, i) => ({
  id: `${i}`,
  name: `Member ${i + 1}`,
  email: `member${i + 1}@example.com`,
  role: i % 3 === 0 ? "Admin" : "Editor",
  joined: `2026-0${(i % 9) + 1}-12`,
}));

const DATA_TABLE_COLUMNS: import("@tanstack/react-table").ColumnDef<DataRow>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "email", header: "Email" },
  { accessorKey: "role", header: "Role" },
  { accessorKey: "joined", header: "Joined" },
];

const CHART_DATA = [
  { day: "Mon", sent: 1240, delivered: 1198 },
  { day: "Tue", sent: 1380, delivered: 1331 },
  { day: "Wed", sent: 1520, delivered: 1489 },
  { day: "Thu", sent: 1410, delivered: 1378 },
  { day: "Fri", sent: 1690, delivered: 1648 },
  { day: "Sat", sent: 1110, delivered: 1090 },
  { day: "Sun", sent: 980, delivered: 962 },
];

const CALENDAR_EVENTS = [
  { id: "e1", date: new Date(), title: "Standup" },
  { id: "e2", date: new Date(Date.now() + 86400000 * 2), title: "Sprint review" },
  { id: "e3", date: new Date(Date.now() + 86400000 * 5), title: "Customer call" },
];

const TESTIMONIALS = [
  {
    text: "ZoruUI made the dashboard feel calm again. Removing the multi-tab strip alone gave us back a third of the chrome.",
    name: "Aria Patel",
    role: "Head of Design, Acme",
    image: "https://i.pravatar.cc/96?img=12",
  },
  {
    text: "The neutral palette was a tougher sell than I thought — until our team saw how much faster scanning data tables got.",
    name: "Sam Chen",
    role: "Engineering Lead, Globex",
    image: "https://i.pravatar.cc/96?img=15",
  },
  {
    text: "Reusing the dock and dropping the URL-tab system meant migration risk dropped to almost zero.",
    name: "Lin Wu",
    role: "Staff Engineer, Initech",
    image: "https://i.pravatar.cc/96?img=33",
  },
  {
    text: "Cards finally look like cards. Tables finally look like tables. No more rainbow surfaces.",
    name: "Mira Singh",
    role: "Product Manager, Soylent",
    image: "https://i.pravatar.cc/96?img=20",
  },
  {
    text: "The data-table primitive replaced four bespoke implementations across our CRM in a single afternoon.",
    name: "Diego Cruz",
    role: "Senior Frontend, Umbrella",
    image: "https://i.pravatar.cc/96?img=24",
  },
  {
    text: "Quiet, fast, accessible — and the hero pill still ships.",
    name: "Tomás Reyes",
    role: "Founder, Wonka",
    image: "https://i.pravatar.cc/96?img=27",
  },
];

const SAMPLE_FILES = [
  {
    id: "f1",
    name: "Brand deck.pdf",
    mime: "application/pdf",
    size: 4_200_000,
    modified: new Date(),
  },
  {
    id: "f2",
    name: "Hero.png",
    mime: "image/png",
    size: 1_800_000,
    modified: new Date(),
    thumbnailUrl:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=60",
  },
  {
    id: "f3",
    name: "Soundtrack.mp3",
    mime: "audio/mpeg",
    size: 6_400_000,
    modified: new Date(),
  },
];

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
