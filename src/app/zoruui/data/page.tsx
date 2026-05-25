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


export default function DataPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zoru-ink capitalize">data</h1>
        <p className="mt-2 text-base text-zoru-ink-muted">Explore data components</p>
      </div>
      <Section step="Step 2" title="Display, badges, progress, skeleton">
<SnippetDemo code={`
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="ghost">Ghost</Badge>
            <Badge variant="success">Active</Badge>
            <Badge variant="danger">Failed</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="info">Info</Badge>
          </div>
          <Separator />
          <div className="flex items-center gap-4">
            <Avatar>
              <ZoruAvatarImage src="https://i.pravatar.cc/96?img=12" alt="Avatar" />
              <ZoruAvatarFallback>HK</ZoruAvatarFallback>
            </Avatar>
            <Avatar>
              <ZoruAvatarFallback>
                <User className="h-4 w-4" />
              </ZoruAvatarFallback>
            </Avatar>
            <Tooltip>
              <ZoruTooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Help">
                  <Settings />
                </Button>
              </ZoruTooltipTrigger>
              <ZoruTooltipContent>Open settings</ZoruTooltipContent>
            </Tooltip>
            <ZoruKbd>⌘</ZoruKbd>
            <ZoruKbd>⇧</ZoruKbd>
            <ZoruKbd>P</ZoruKbd>
          </div>
          <div className="space-y-3">
            <Progress value={32} />
            <Progress value={68} />
            <Progress value={94} />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        `}>

          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="ghost">Ghost</Badge>
            <Badge variant="success">Active</Badge>
            <Badge variant="danger">Failed</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="info">Info</Badge>
          </div>
          <Separator />
          <div className="flex items-center gap-4">
            <Avatar>
              <ZoruAvatarImage src="https://i.pravatar.cc/96?img=12" alt="Avatar" />
              <ZoruAvatarFallback>HK</ZoruAvatarFallback>
            </Avatar>
            <Avatar>
              <ZoruAvatarFallback>
                <User className="h-4 w-4" />
              </ZoruAvatarFallback>
            </Avatar>
            <Tooltip>
              <ZoruTooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Help">
                  <Settings />
                </Button>
              </ZoruTooltipTrigger>
              <ZoruTooltipContent>Open settings</ZoruTooltipContent>
            </Tooltip>
            <ZoruKbd>⌘</ZoruKbd>
            <ZoruKbd>⇧</ZoruKbd>
            <ZoruKbd>P</ZoruKbd>
          </div>
          <div className="space-y-3">
            <Progress value={32} />
            <Progress value={68} />
            <Progress value={94} />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        
</SnippetDemo>
</Section>
<Section
          step="Step 5"
          title="Tables — basic, click-to-dialog, data-table"
        >
<SnippetDemo code={`
          <Card>
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
                      <Badge variant={r.status === "Active" ? "success" : "ghost"}>
                        {r.status}
                      </Badge>
                    ),
                  },
                  { key: "updated", header: "Updated", align: "right" },
                ]}
                rowTitle={(r) => r.name}
                rowDescription={(r) => \`Owned by \${r.owner}\`}
                rowDialog={(r) => (
                  <p className="text-sm text-zoru-ink-muted">
                    Replace this body with the row detail editor for{" "}
                    <span className="font-medium text-zoru-ink">{r.name}</span>.
                  </p>
                )}
              />
            </ZoruCardContent>
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Tanstack data-table</ZoruCardTitle>
              <ZoruCardDescription>
                Sort, filter, paginate, toggle columns.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
              <DataTable
                columns={DATA_TABLE_COLUMNS}
                data={DATA_TABLE_ROWS}
                filterColumn="name"
                filterPlaceholder="Filter by name…"
                pageSize={5}
              />
            </ZoruCardContent>
          </Card>
        `}>

          <Card>
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
                      <Badge variant={r.status === "Active" ? "success" : "ghost"}>
                        {r.status}
                      </Badge>
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
          </Card>

          <Card>
            <ZoruCardHeader>
              <ZoruCardTitle>Tanstack data-table</ZoruCardTitle>
              <ZoruCardDescription>
                Sort, filter, paginate, toggle columns.
              </ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
              <DataTable
                columns={DATA_TABLE_COLUMNS}
                data={DATA_TABLE_ROWS}
                filterColumn="name"
                filterPlaceholder="Filter by name…"
                pageSize={5}
              />
            </ZoruCardContent>
          </Card>
        
</SnippetDemo>
</Section>
<Section step="Step 5" title="File upload + files module">
<SnippetDemo code={`
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
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
            </Card>
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Files page (composed)</ZoruCardTitle>
                <ZoruCardDescription>
                  Toolbar + grid + 5 dialogs in one drop-in.
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <ZoruFilesPage files={SAMPLE_FILES} onUpload={() => {}} onRename={() => {}} onDelete={() => {}} />
              </ZoruCardContent>
            </Card>
          </div>
        `}>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
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
            </Card>
            <Card>
              <ZoruCardHeader>
                <ZoruCardTitle>Files page (composed)</ZoruCardTitle>
                <ZoruCardDescription>
                  Toolbar + grid + 5 dialogs in one drop-in.
                </ZoruCardDescription>
              </ZoruCardHeader>
              <ZoruCardContent>
                <ZoruFilesPage files={SAMPLE_FILES} onUpload={() => {}} onRename={() => {}} onDelete={() => {}} />
              </ZoruCardContent>
            </Card>
          </div>
        
</SnippetDemo>
</Section>
    </div>
  );
}
