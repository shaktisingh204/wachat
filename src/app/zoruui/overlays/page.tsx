"use client";

import React from "react";
import { SnippetDemo } from "../components/SnippetDemo";
import { Section } from "../components/Section";
import { Field, DemoDatePicker, DemoDateRange, CommandAndToastDemo } from "../components/local";
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

} from "@/components/sabcrm/20ui/zoru";
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


export default function OverlaysPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--st-text)] capitalize">overlays</h1>
        <p className="mt-2 text-base text-[var(--st-text-secondary)]">Explore overlays components</p>
      </div>
      <Section step="Step 3" title="Hero pill + alerts">
<SnippetDemo code={`
          <div className="flex flex-wrap items-center gap-3">
            <ZoruHeroPill icon={<ZoruStarIcon />} text="New releases every week" />
            <ZoruHeroPill icon={<Sparkles className="size-3" />} text="Now in beta" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Alert variant="info">
              <Info />
              <ZoruAlertTitle>Heads up</ZoruAlertTitle>
              <ZoruAlertDescription>
                We bumped the rate limit on free plans to 1,000 requests/day.
              </ZoruAlertDescription>
            </Alert>
            <Alert variant="success">
              <CircleCheck />
              <ZoruAlertTitle>All set</ZoruAlertTitle>
              <ZoruAlertDescription>
                Your workspace is provisioned and ready to use.
              </ZoruAlertDescription>
            </Alert>
            <Alert variant="warning">
              <CircleAlert />
              <ZoruAlertTitle>Pending verification</ZoruAlertTitle>
              <ZoruAlertDescription>
                We&apos;re still verifying your business document.
              </ZoruAlertDescription>
            </Alert>
            <Alert variant="destructive">
              <CircleAlert />
              <ZoruAlertTitle>Connection failed</ZoruAlertTitle>
              <ZoruAlertDescription>
                We couldn&apos;t reach the upstream provider. Retrying…
              </ZoruAlertDescription>
            </Alert>
          </div>
        `}>

          <div className="flex flex-wrap items-center gap-3">
            <ZoruHeroPill icon={<ZoruStarIcon />} text="New releases every week" />
            <ZoruHeroPill icon={<Sparkles className="size-3" />} text="Now in beta" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Alert variant="info">
              <Info />
              <ZoruAlertTitle>Heads up</ZoruAlertTitle>
              <ZoruAlertDescription>
                We bumped the rate limit on free plans to 1,000 requests/day.
              </ZoruAlertDescription>
            </Alert>
            <Alert variant="success">
              <CircleCheck />
              <ZoruAlertTitle>All set</ZoruAlertTitle>
              <ZoruAlertDescription>
                Your workspace is provisioned and ready to use.
              </ZoruAlertDescription>
            </Alert>
            <Alert variant="warning">
              <CircleAlert />
              <ZoruAlertTitle>Pending verification</ZoruAlertTitle>
              <ZoruAlertDescription>
                We&apos;re still verifying your business document.
              </ZoruAlertDescription>
            </Alert>
            <Alert variant="destructive">
              <CircleAlert />
              <ZoruAlertTitle>Connection failed</ZoruAlertTitle>
              <ZoruAlertDescription>
                We couldn&apos;t reach the upstream provider. Retrying…
              </ZoruAlertDescription>
            </Alert>
          </div>
        
</SnippetDemo>
</Section>
<Section step="Step 3" title="Dialog · Sheet · Drawer · Alert dialog">
<SnippetDemo code={`
          <div className="flex flex-wrap items-center gap-3">
            <Dialog>
              <ZoruDialogTrigger asChild>
                <Button>Open dialog</Button>
              </ZoruDialogTrigger>
              <ZoruDialogContent>
                <ZoruDialogHeader>
                  <ZoruDialogTitle>Invite a teammate</ZoruDialogTitle>
                  <ZoruDialogDescription>
                    They&apos;ll get an email with a link to join your workspace.
                  </ZoruDialogDescription>
                </ZoruDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="zoru-invite-email">Work email</Label>
                  <Input
                    id="zoru-invite-email"
                    type="email"
                    placeholder="teammate@company.com"
                    leadingSlot={<Mail />}
                  />
                </div>
                <ZoruDialogFooter>
                  <Button variant="ghost">Cancel</Button>
                  <Button>Send invite</Button>
                </ZoruDialogFooter>
              </ZoruDialogContent>
            </Dialog>

            <Sheet>
              <ZoruSheetTrigger asChild>
                <Button variant="outline">Open sheet</Button>
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
                    <Checkbox id="zoru-flt-1" defaultChecked />
                    <Label htmlFor="zoru-flt-1">Open</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id="zoru-flt-2" />
                    <Label htmlFor="zoru-flt-2">Closed</Label>
                  </div>
                </div>
                <ZoruSheetFooter className="mt-6">
                  <Button variant="ghost">Reset</Button>
                  <Button>Apply</Button>
                </ZoruSheetFooter>
              </ZoruSheetContent>
            </Sheet>

            <ZoruDrawer>
              <ZoruDrawerTrigger asChild>
                <Button variant="secondary">Open drawer</Button>
              </ZoruDrawerTrigger>
              <ZoruDrawerContent>
                <ZoruDrawerHeader>
                  <ZoruDrawerTitle>Quick actions</ZoruDrawerTitle>
                  <ZoruDrawerDescription>
                    Mobile-friendly bottom sheet powered by Vaul.
                  </ZoruDrawerDescription>
                </ZoruDrawerHeader>
                <div className="px-4 pb-2 sm:px-6">
                  <p className="text-sm text-[var(--st-text-secondary)]">
                    Drawers are perfect for actions that need a moment of focus
                    without leaving the page.
                  </p>
                </div>
                <ZoruDrawerFooter>
                  <Button>Got it</Button>
                </ZoruDrawerFooter>
              </ZoruDrawerContent>
            </ZoruDrawer>

            <ZoruAlertDialog>
              <ZoruAlertDialogTrigger asChild>
                <Button variant="destructive">Delete account</Button>
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
        `}>

          <div className="flex flex-wrap items-center gap-3">
            <Dialog>
              <ZoruDialogTrigger asChild>
                <Button>Open dialog</Button>
              </ZoruDialogTrigger>
              <ZoruDialogContent>
                <ZoruDialogHeader>
                  <ZoruDialogTitle>Invite a teammate</ZoruDialogTitle>
                  <ZoruDialogDescription>
                    They&apos;ll get an email with a link to join your workspace.
                  </ZoruDialogDescription>
                </ZoruDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="zoru-invite-email">Work email</Label>
                  <Input
                    id="zoru-invite-email"
                    type="email"
                    placeholder="teammate@company.com"
                    leadingSlot={<Mail />}
                  />
                </div>
                <ZoruDialogFooter>
                  <Button variant="ghost">Cancel</Button>
                  <Button>Send invite</Button>
                </ZoruDialogFooter>
              </ZoruDialogContent>
            </Dialog>

            <Sheet>
              <ZoruSheetTrigger asChild>
                <Button variant="outline">Open sheet</Button>
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
                    <Checkbox id="zoru-flt-1" defaultChecked />
                    <Label htmlFor="zoru-flt-1">Open</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox id="zoru-flt-2" />
                    <Label htmlFor="zoru-flt-2">Closed</Label>
                  </div>
                </div>
                <ZoruSheetFooter className="mt-6">
                  <Button variant="ghost">Reset</Button>
                  <Button>Apply</Button>
                </ZoruSheetFooter>
              </ZoruSheetContent>
            </Sheet>

            <ZoruDrawer>
              <ZoruDrawerTrigger asChild>
                <Button variant="secondary">Open drawer</Button>
              </ZoruDrawerTrigger>
              <ZoruDrawerContent>
                <ZoruDrawerHeader>
                  <ZoruDrawerTitle>Quick actions</ZoruDrawerTitle>
                  <ZoruDrawerDescription>
                    Mobile-friendly bottom sheet powered by Vaul.
                  </ZoruDrawerDescription>
                </ZoruDrawerHeader>
                <div className="px-4 pb-2 sm:px-6">
                  <p className="text-sm text-[var(--st-text-secondary)]">
                    Drawers are perfect for actions that need a moment of focus
                    without leaving the page.
                  </p>
                </div>
                <ZoruDrawerFooter>
                  <Button>Got it</Button>
                </ZoruDrawerFooter>
              </ZoruDrawerContent>
            </ZoruDrawer>

            <ZoruAlertDialog>
              <ZoruAlertDialogTrigger asChild>
                <Button variant="destructive">Delete account</Button>
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
        
</SnippetDemo>
</Section>
<Section step="Step 3" title="Popover · Dropdown · Menubar">
<SnippetDemo code={`
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <ZoruPopoverTrigger asChild>
                <Button variant="outline">
                  <Calendar /> Schedule
                </Button>
              </ZoruPopoverTrigger>
              <ZoruPopoverContent>
                <p className="text-sm font-medium text-[var(--st-text)]">Pick a date</p>
                <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                  Calendar primitives ship in step 5.
                </p>
              </ZoruPopoverContent>
            </Popover>

            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Row actions">
                  <MoreHorizontal />
                </Button>
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
            </DropdownMenu>

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
        `}>

          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <ZoruPopoverTrigger asChild>
                <Button variant="outline">
                  <Calendar /> Schedule
                </Button>
              </ZoruPopoverTrigger>
              <ZoruPopoverContent>
                <p className="text-sm font-medium text-[var(--st-text)]">Pick a date</p>
                <p className="mt-1 text-xs text-[var(--st-text-secondary)]">
                  Calendar primitives ship in step 5.
                </p>
              </ZoruPopoverContent>
            </Popover>

            <DropdownMenu>
              <ZoruDropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Row actions">
                  <MoreHorizontal />
                </Button>
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
            </DropdownMenu>

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
        
</SnippetDemo>
</Section>
<Section step="Step 3" title="Command palette + toasts">
<SnippetDemo code={`
          <CommandAndToastDemo />
        `}>

          <CommandAndToastDemo />
        
</SnippetDemo>
</Section>
    </div>
  );
}
