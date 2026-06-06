"use client";

import React from "react";
import { SnippetDemo } from "../components/SnippetDemo";
import { Section } from "../components/Section";
import { Field, DemoDatePicker, DemoDateRange } from "../components/local";
import {
  ZORU_CHART_PALETTE,
  Accordion,
  ZoruAccordion03,
  ZoruAccordion03Content,
  ZoruAccordion03Item,
  ZoruAccordion03Trigger,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruActionSearchBar,
  Alert,
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
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  ZoruBouncyToggle,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  ZoruCallToAction,
  Card,
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
  DatePicker,
  ZoruDateRangePicker,
  Checkbox,
  ZoruCommandDialog,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandInput,
  ZoruCommandItem,
  ZoruCommandList,
  ZoruCommandShortcut,
  Dialog,
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
  DropdownMenu,
  ZoruDropdownMenuCheckboxItem,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuShortcut,
  ZoruDropdownMenuTrigger,
  EmptyState,
  ZoruFeatureCard,
  ZoruFeatureGrid,
  ZoruFileUploadCard,
  ZoruFilesPage,
  ZoruFullscreenCalendar,
  ZoruHeader,
  ZoruHeroPill,
  Input,
  ZoruJobListing,
  ZoruLogos3,
  ZoruKbd,
  Label,
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
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Popover,
  ZoruPricingCard,
  ZoruPricingTier,
  ZoruPopoverContent,
  ZoruPopoverTrigger,
  Progress,
  ZoruRadioCard,
  RadioGroup,
  ZoruRadioGroupItem,
  ScrollArea,
  ZoruTestimonialsColumns,
  ZoruUserDropdown,
  ZoruWaterLoader,
  Select,
  StatCard,
  ZoruStatisticsCard1,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  ZoruTableWithDialog,
  DataTable,
  Sheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetFooter,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetTrigger,
  Skeleton,
  ZoruStarIcon,
  Switch,
  Textarea,
  ZoruToaster,
  Tooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  zoruToast,
  ZoruProvider,

} from "@/components/zoruui";
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
import { ROWS, DATA_TABLE_ROWS, DATA_TABLE_COLUMNS, CHART_DATA, CALENDAR_EVENTS, TESTIMONIALS, SAMPLE_FILES } from "../components/data";


export default function LayoutElementsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--st-text)] capitalize">layout elements</h1>
        <p className="mt-2 text-base text-[var(--st-text-secondary)]">Explore layout elements components</p>
      </div>
      <Section
          step="Step 4"
          title="Page header + breadcrumb"
          subtitle="Standard top-of-page block — eyebrow, title, description, actions."
        >
<SnippetDemo code={`
          <PageHeader>
            <ZoruPageHeading>
              <Breadcrumb>
                <ZoruBreadcrumbList>
                  <ZoruBreadcrumbItem>
                    <ZoruBreadcrumbLink href="/zoruui">ZoruUI</ZoruBreadcrumbLink>
                  </ZoruBreadcrumbItem>
                  <ZoruBreadcrumbSeparator />
                  <ZoruBreadcrumbItem>
                    <ZoruBreadcrumbPage>Layout primitives</ZoruBreadcrumbPage>
                  </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
              </Breadcrumb>
              <ZoruPageTitle>Layout primitives</ZoruPageTitle>
              <ZoruPageDescription>
                Cards, page headers, breadcrumbs, tabs, accordions, scroll areas
                and resizable panels — every layout building block needed for
                step 7 onwards.
              </ZoruPageDescription>
            </ZoruPageHeading>
            <ZoruPageActions>
              <Button variant="ghost">Export</Button>
              <Button>
                <PlusCircle /> New project
              </Button>
            </ZoruPageActions>
          </PageHeader>
        `}>

          <PageHeader>
            <ZoruPageHeading>
              <Breadcrumb>
                <ZoruBreadcrumbList>
                  <ZoruBreadcrumbItem>
                    <ZoruBreadcrumbLink href="/zoruui">ZoruUI</ZoruBreadcrumbLink>
                  </ZoruBreadcrumbItem>
                  <ZoruBreadcrumbSeparator />
                  <ZoruBreadcrumbItem>
                    <ZoruBreadcrumbPage>Layout primitives</ZoruBreadcrumbPage>
                  </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
              </Breadcrumb>
              <ZoruPageTitle>Layout primitives</ZoruPageTitle>
              <ZoruPageDescription>
                Cards, page headers, breadcrumbs, tabs, accordions, scroll areas
                and resizable panels — every layout building block needed for
                step 7 onwards.
              </ZoruPageDescription>
            </ZoruPageHeading>
            <ZoruPageActions>
              <Button variant="ghost">Export</Button>
              <Button>
                <PlusCircle /> New project
              </Button>
            </ZoruPageActions>
          </PageHeader>
        
</SnippetDemo>
</Section>
<Section step="Step 4" title="Scroll area + empty state + limelight">
<SnippetDemo code={`
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Scroll area</ZoruCardTitle>
                <ZoruCardDescription>240px tall, custom scrollbar.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <ScrollArea className="h-60 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
                  <ul className="space-y-2 text-sm text-[var(--st-text)]">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <li
                        key={i}
                        className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] px-3 py-2"
                      >
                        Row {i + 1}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </ZoruCardContent>
            </Card>

            <EmptyState
              icon={<FolderOpen />}
              title="No projects yet"
              description="Create your first project to start tracking conversations and broadcasts."
              action={
                <Button>
                  <PlusCircle /> New project
                </Button>
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
        `}>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Scroll area</ZoruCardTitle>
                <ZoruCardDescription>240px tall, custom scrollbar.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <ScrollArea className="h-60 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
                  <ul className="space-y-2 text-sm text-[var(--st-text)]">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <li
                        key={i}
                        className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)] px-3 py-2"
                      >
                        Row {i + 1}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </ZoruCardContent>
            </Card>

            <EmptyState
              icon={<FolderOpen />}
              title="No projects yet"
              description="Create your first project to start tracking conversations and broadcasts."
              action={
                <Button>
                  <PlusCircle /> New project
                </Button>
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
        
</SnippetDemo>
</Section>
<Section
          step="Step 4"
          title="Shell preview"
          subtitle="Sidebar + header + dock — no vertical app rail (apps live in the dock now), no multi-tab strip. Step 8 wires the admin instance, step 9 the dashboard."
        >
<SnippetDemo code={`
          <div className="overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)]">
            <div className="flex h-[420px] w-full bg-[var(--st-bg)]">
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
                    <Breadcrumb>
                      <ZoruBreadcrumbList>
                        <ZoruBreadcrumbItem>
                          <ZoruBreadcrumbLink href="#">Dashboard</ZoruBreadcrumbLink>
                        </ZoruBreadcrumbItem>
                        <ZoruBreadcrumbSeparator />
                        <ZoruBreadcrumbItem>
                          <ZoruBreadcrumbPage>Overview</ZoruBreadcrumbPage>
                        </ZoruBreadcrumbItem>
                      </ZoruBreadcrumbList>
                    </Breadcrumb>
                  }
                  center={
                    <Input
                      placeholder="Search anything…"
                      leadingSlot={<Search />}
                      trailingSlot={<ZoruKbd>⌘K</ZoruKbd>}
                    />
                  }
                  trailing={
                    <>
                      <Button variant="ghost" size="icon" aria-label="Notifications">
                        <Bell />
                      </Button>
                      <Avatar>
                        <ZoruAvatarFallback>HK</ZoruAvatarFallback>
                      </Avatar>
                    </>
                  }
                />
                <main className="flex-1 overflow-y-auto p-6">
                  <EmptyState
                    icon={<Sparkles />}
                    title="Your shell is ready"
                    description="No multi-tab strip. The dock slot is wired but empty — step 9 will fill it in for the dashboard."
                    compact
                  />
                </main>
              </div>
            </div>
          </div>
        `}>

          <div className="overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)]">
            <div className="flex h-[420px] w-full bg-[var(--st-bg)]">
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
                    <Breadcrumb>
                      <ZoruBreadcrumbList>
                        <ZoruBreadcrumbItem>
                          <ZoruBreadcrumbLink href="#">Dashboard</ZoruBreadcrumbLink>
                        </ZoruBreadcrumbItem>
                        <ZoruBreadcrumbSeparator />
                        <ZoruBreadcrumbItem>
                          <ZoruBreadcrumbPage>Overview</ZoruBreadcrumbPage>
                        </ZoruBreadcrumbItem>
                      </ZoruBreadcrumbList>
                    </Breadcrumb>
                  }
                  center={
                    <Input
                      placeholder="Search anything…"
                      leadingSlot={<Search />}
                      trailingSlot={<ZoruKbd>⌘K</ZoruKbd>}
                    />
                  }
                  trailing={
                    <>
                      <Button variant="ghost" size="icon" aria-label="Notifications">
                        <Bell />
                      </Button>
                      <Avatar>
                        <ZoruAvatarFallback>HK</ZoruAvatarFallback>
                      </Avatar>
                    </>
                  }
                />
                <main className="flex-1 overflow-y-auto p-6">
                  <EmptyState
                    icon={<Sparkles />}
                    title="Your shell is ready"
                    description="No multi-tab strip. The dock slot is wired but empty — step 9 will fill it in for the dashboard."
                    compact
                  />
                </main>
              </div>
            </div>
          </div>
        
</SnippetDemo>
</Section>
<Section step="Step 6" title="Action search bar + user dropdown + water loader">
<SnippetDemo code={`
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
        `}>

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
        
</SnippetDemo>
</Section>
    </div>
  );
}
