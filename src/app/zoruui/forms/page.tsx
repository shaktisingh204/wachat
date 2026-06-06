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


export default function FormsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--st-text)] capitalize">forms</h1>
        <p className="mt-2 text-base text-[var(--st-text-secondary)]">Explore forms components</p>
      </div>
      <Section step="Step 2" title="Text inputs">
<SnippetDemo code={`
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="zoru-demo-email">
              <Input
                id="zoru-demo-email"
                type="email"
                placeholder="you@company.com"
                leadingSlot={<Mail />}
              />
            </Field>
            <Field label="Search" htmlFor="zoru-demo-search">
              <Input
                id="zoru-demo-search"
                placeholder="Search anything…"
                leadingSlot={<Search />}
                trailingSlot={<ZoruKbd>⌘K</ZoruKbd>}
              />
            </Field>
            <Field label="Disabled" htmlFor="zoru-demo-disabled">
              <Input id="zoru-demo-disabled" disabled defaultValue="read only" />
            </Field>
            <Field label="Invalid" htmlFor="zoru-demo-invalid">
              <Input id="zoru-demo-invalid" invalid defaultValue="bad value" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Message" htmlFor="zoru-demo-textarea">
                <Textarea
                  id="zoru-demo-textarea"
                  placeholder="Type your message here…"
                  rows={4}
                />
              </Field>
            </div>
          </div>
        `}>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="zoru-demo-email">
              <Input
                id="zoru-demo-email"
                type="email"
                placeholder="you@company.com"
                leadingSlot={<Mail />}
              />
            </Field>
            <Field label="Search" htmlFor="zoru-demo-search">
              <Input
                id="zoru-demo-search"
                placeholder="Search anything…"
                leadingSlot={<Search />}
                trailingSlot={<ZoruKbd>⌘K</ZoruKbd>}
              />
            </Field>
            <Field label="Disabled" htmlFor="zoru-demo-disabled">
              <Input id="zoru-demo-disabled" disabled defaultValue="read only" />
            </Field>
            <Field label="Invalid" htmlFor="zoru-demo-invalid">
              <Input id="zoru-demo-invalid" invalid defaultValue="bad value" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Message" htmlFor="zoru-demo-textarea">
                <Textarea
                  id="zoru-demo-textarea"
                  placeholder="Type your message here…"
                  rows={4}
                />
              </Field>
            </div>
          </div>
        
</SnippetDemo>
</Section>
<Section step="Step 2" title="Choice controls">
<SnippetDemo code={`
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-4">
              <p className="text-sm font-medium text-[var(--st-text)]">Checkboxes</p>
              <div className="flex items-center gap-3">
                <Checkbox id="zoru-cb-1" defaultChecked />
                <Label htmlFor="zoru-cb-1">Receive product updates</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="zoru-cb-2" />
                <Label htmlFor="zoru-cb-2">Subscribe to changelog</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="zoru-cb-3" disabled />
                <Label htmlFor="zoru-cb-3">Disabled option</Label>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-sm font-medium text-[var(--st-text)]">Switches</p>
              <div className="flex items-center gap-3">
                <Switch id="zoru-sw-1" defaultChecked />
                <Label htmlFor="zoru-sw-1">Enable notifications</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="zoru-sw-2" />
                <Label htmlFor="zoru-sw-2">Auto-archive replies</Label>
              </div>
              <ZoruBouncyToggle label="Marketing emails" defaultChecked />
            </div>
          </div>
        `}>

          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-4">
              <p className="text-sm font-medium text-[var(--st-text)]">Checkboxes</p>
              <div className="flex items-center gap-3">
                <Checkbox id="zoru-cb-1" defaultChecked />
                <Label htmlFor="zoru-cb-1">Receive product updates</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="zoru-cb-2" />
                <Label htmlFor="zoru-cb-2">Subscribe to changelog</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="zoru-cb-3" disabled />
                <Label htmlFor="zoru-cb-3">Disabled option</Label>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-sm font-medium text-[var(--st-text)]">Switches</p>
              <div className="flex items-center gap-3">
                <Switch id="zoru-sw-1" defaultChecked />
                <Label htmlFor="zoru-sw-1">Enable notifications</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="zoru-sw-2" />
                <Label htmlFor="zoru-sw-2">Auto-archive replies</Label>
              </div>
              <ZoruBouncyToggle label="Marketing emails" defaultChecked />
            </div>
          </div>
        
</SnippetDemo>
</Section>
<Section step="Step 2" title="Radio group + cards">
<SnippetDemo code={`
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--st-text)]">Inline</p>
              <RadioGroup defaultValue="monthly">
                <div className="flex items-center gap-3">
                  <ZoruRadioGroupItem value="monthly" id="zoru-r-1" />
                  <Label htmlFor="zoru-r-1">Monthly</Label>
                </div>
                <div className="flex items-center gap-3">
                  <ZoruRadioGroupItem value="yearly" id="zoru-r-2" />
                  <Label htmlFor="zoru-r-2">Yearly</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--st-text)]">Cards</p>
              <RadioGroup defaultValue="pro">
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
              </RadioGroup>
            </div>
          </div>
        `}>

          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--st-text)]">Inline</p>
              <RadioGroup defaultValue="monthly">
                <div className="flex items-center gap-3">
                  <ZoruRadioGroupItem value="monthly" id="zoru-r-1" />
                  <Label htmlFor="zoru-r-1">Monthly</Label>
                </div>
                <div className="flex items-center gap-3">
                  <ZoruRadioGroupItem value="yearly" id="zoru-r-2" />
                  <Label htmlFor="zoru-r-2">Yearly</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-[var(--st-text)]">Cards</p>
              <RadioGroup defaultValue="pro">
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
              </RadioGroup>
            </div>
          </div>
        
</SnippetDemo>
</Section>
<Section step="Step 2" title="Select">
<SnippetDemo code={`
          <div className="max-w-xs">
            <Field label="Region" htmlFor="zoru-select-region">
              <Select>
                <ZoruSelectTrigger id="zoru-select-region">
                  <ZoruSelectValue placeholder="Choose a region…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="us-east">US East (N. Virginia)</ZoruSelectItem>
                  <ZoruSelectItem value="us-west">US West (Oregon)</ZoruSelectItem>
                  <ZoruSelectItem value="eu-west">EU West (Ireland)</ZoruSelectItem>
                  <ZoruSelectItem value="ap-south">AP South (Mumbai)</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </Field>
          </div>
        `}>

          <div className="max-w-xs">
            <Field label="Region" htmlFor="zoru-select-region">
              <Select>
                <ZoruSelectTrigger id="zoru-select-region">
                  <ZoruSelectValue placeholder="Choose a region…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="us-east">US East (N. Virginia)</ZoruSelectItem>
                  <ZoruSelectItem value="us-west">US West (Oregon)</ZoruSelectItem>
                  <ZoruSelectItem value="eu-west">EU West (Ireland)</ZoruSelectItem>
                  <ZoruSelectItem value="ap-south">AP South (Mumbai)</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </Field>
          </div>
        
</SnippetDemo>
</Section>
    </div>
  );
}
