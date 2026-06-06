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


export default function CardsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--st-text)] capitalize">cards</h1>
        <p className="mt-2 text-base text-[var(--st-text-secondary)]">Explore cards components</p>
      </div>
      <Section step="Step 4" title="Cards (5 variants)">
<SnippetDemo code={`
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Default card</ZoruCardTitle>
                <ZoruCardDescription>Bordered, subtle.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <p className="text-sm text-[var(--st-text-secondary)]">
                  Quiet container for grouped content.
                </p>
              </ZoruCardContent>
            </Card>
            <Card variant="soft">
              <ZoruCardHeader>
                <ZoruCardTitle>Soft</ZoruCardTitle>
                <ZoruCardDescription>Borderless, surface tint.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <p className="text-sm text-[var(--st-text-secondary)]">Use inside dense layouts.</p>
              </ZoruCardContent>
            </Card>
            <Card variant="elevated">
              <ZoruCardHeader>
                <ZoruCardTitle>Elevated</ZoruCardTitle>
                <ZoruCardDescription>Drop shadow on idle.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <p className="text-sm text-[var(--st-text-secondary)]">Stands off the canvas.</p>
              </ZoruCardContent>
            </Card>
            <Card variant="outline">
              <ZoruCardHeader>
                <ZoruCardTitle>Outline</ZoruCardTitle>
                <ZoruCardDescription>Stronger border, no shadow.</ZoruCardDescription>
              </ZoruCardHeader>
            </Card>
            <Card interactive>
              <ZoruCardHeader>
                <ZoruCardTitle>Interactive</ZoruCardTitle>
                <ZoruCardDescription>Hover lifts the shadow.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardFooter>
                <Button variant="link">Open project →</Button>
              </ZoruCardFooter>
            </Card>
          </div>
        `}>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Default card</ZoruCardTitle>
                <ZoruCardDescription>Bordered, subtle.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <p className="text-sm text-[var(--st-text-secondary)]">
                  Quiet container for grouped content.
                </p>
              </ZoruCardContent>
            </Card>
            <Card variant="soft">
              <ZoruCardHeader>
                <ZoruCardTitle>Soft</ZoruCardTitle>
                <ZoruCardDescription>Borderless, surface tint.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <p className="text-sm text-[var(--st-text-secondary)]">Use inside dense layouts.</p>
              </ZoruCardContent>
            </Card>
            <Card variant="elevated">
              <ZoruCardHeader>
                <ZoruCardTitle>Elevated</ZoruCardTitle>
                <ZoruCardDescription>Drop shadow on idle.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <p className="text-sm text-[var(--st-text-secondary)]">Stands off the canvas.</p>
              </ZoruCardContent>
            </Card>
            <Card variant="outline">
              <ZoruCardHeader>
                <ZoruCardTitle>Outline</ZoruCardTitle>
                <ZoruCardDescription>Stronger border, no shadow.</ZoruCardDescription>
              </ZoruCardHeader>
            </Card>
            <Card interactive>
              <ZoruCardHeader>
                <ZoruCardTitle>Interactive</ZoruCardTitle>
                <ZoruCardDescription>Hover lifts the shadow.</ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardFooter>
                <Button variant="link">Open project →</Button>
              </ZoruCardFooter>
            </Card>
          </div>
        
</SnippetDemo>
</Section>
<Section step="Step 4" title="Accordion (default + boxed)">
<SnippetDemo code={`
          <div className="grid gap-6 lg:grid-cols-2">
            <Accordion type="single" collapsible>
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
            </Accordion>

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
        `}>

          <div className="grid gap-6 lg:grid-cols-2">
            <Accordion type="single" collapsible>
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
            </Accordion>

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
        
</SnippetDemo>
</Section>
<Section step="Step 5" title="Stat cards + chart">
<SnippetDemo code={`
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active conversations"
              value="12,840"
              delta={4.2}
              period="vs last week"
              icon={<Activity />}
            />
            <StatCard
              label="Delivered"
              value="98.4%"
              delta={0.6}
              period="last 24h"
              icon={<CheckCircle2 />}
            />
            <StatCard
              label="Failed"
              value="0.7%"
              delta={-0.2}
              period="last 24h"
              invertDelta
              icon={<CircleAlert />}
            />
            <StatCard
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

          <Card>
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
          </Card>
        `}>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active conversations"
              value="12,840"
              delta={4.2}
              period="vs last week"
              icon={<Activity />}
            />
            <StatCard
              label="Delivered"
              value="98.4%"
              delta={0.6}
              period="last 24h"
              icon={<CheckCircle2 />}
            />
            <StatCard
              label="Failed"
              value="0.7%"
              delta={-0.2}
              period="last 24h"
              invertDelta
              icon={<CircleAlert />}
            />
            <StatCard
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

          <Card>
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
          </Card>
        
</SnippetDemo>
</Section>
<Section step="Step 5" title="Dates: picker, range, calendar, fullscreen">
<SnippetDemo code={`
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DemoDatePicker />
            <DemoDateRange />
            <Card>
              <ZoruCardContent className="pt-6">
                <Calendar mode="single" />
              </ZoruCardContent>
            </Card>
          </div>
          <div className="h-[480px]">
            <ZoruFullscreenCalendar
              events={CALENDAR_EVENTS}
            />
          </div>
        `}>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DemoDatePicker />
            <DemoDateRange />
            <Card>
              <ZoruCardContent className="pt-6">
                <Calendar mode="single" />
              </ZoruCardContent>
            </Card>
          </div>
          <div className="h-[480px]">
            <ZoruFullscreenCalendar
              events={CALENDAR_EVENTS}
            />
          </div>
        
</SnippetDemo>
</Section>
<Section step="Step 5" title="Carousel + color picker">
<SnippetDemo code={`
          <ZoruCarousel className="px-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card
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
                  <Skeleton className="h-24 w-full" />
                </ZoruCardContent>
              </Card>
            ))}
          </ZoruCarousel>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--st-text-secondary)]">Brand colour:</span>
            <ZoruColorPicker value="#0F0F10" />
          </div>
          `}>

          <ZoruCarousel className="px-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card
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
                  <Skeleton className="h-24 w-full" />
                </ZoruCardContent>
              </Card>
            ))}
          </ZoruCarousel>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--st-text-secondary)]">Brand colour:</span>
            <ZoruColorPicker value="#0F0F10" />
          </div>
          
</SnippetDemo>
</Section>
    </div>
  );
}
