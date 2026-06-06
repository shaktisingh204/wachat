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


export default function ButtonsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--st-text)] capitalize">buttons</h1>
        <p className="mt-2 text-base text-[var(--st-text-secondary)]">Explore buttons components</p>
      </div>
      <Section step="Step 2" title="Buttons">
<SnippetDemo code={`
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="success">Success</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Settings">
              <Settings />
            </Button>
            <Button disabled>
              <Loader2 className="animate-spin" /> Loading
            </Button>
            <Button>
              Continue <ArrowRight />
            </Button>
          </div>
        `}>

          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="success">Success</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Settings">
              <Settings />
            </Button>
            <Button disabled>
              <Loader2 className="animate-spin" /> Loading
            </Button>
            <Button>
              Continue <ArrowRight />
            </Button>
          </div>
        
</SnippetDemo>
</Section>
    </div>
  );
}
