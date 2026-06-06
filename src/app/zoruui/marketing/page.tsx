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

} from "@/components/sabcrm/20ui/compat";
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


export default function MarketingPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--st-text)] capitalize">marketing</h1>
        <p className="mt-2 text-base text-[var(--st-text-secondary)]">Explore marketing components</p>
      </div>
      <Section step="Step 6" title="Logos strip + testimonials wall">
<SnippetDemo code={`
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
        `}>

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
        
</SnippetDemo>
</Section>
<Section step="Step 6" title="Feature grid + pricing tier">
<SnippetDemo code={`
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
              price="\$29"
              period="/ month"
              cta={
                <Button variant="outline" block>
                  Start free
                </Button>
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
              price="\$99"
              period="/ month"
              featured
              cta={
                <Button block className="bg-[var(--st-text-inverted)] text-[var(--st-text)] hover:bg-[var(--st-text-inverted)]/90">
                  Choose Pro
                </Button>
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
                <Button variant="outline" block>
                  Talk to sales
                </Button>
              }
              features={[
                { label: "SAML SSO + audit log" },
                { label: "Dedicated CSM" },
                { label: "On-prem option" },
              ]}
            />
          </ZoruPricingTier>
        `}>

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
                <Button variant="outline" block>
                  Start free
                </Button>
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
                <Button block className="bg-[var(--st-text-inverted)] text-[var(--st-text)] hover:bg-[var(--st-text-inverted)]/90">
                  Choose Pro
                </Button>
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
                <Button variant="outline" block>
                  Talk to sales
                </Button>
              }
              features={[
                { label: "SAML SSO + audit log" },
                { label: "Dedicated CSM" },
                { label: "On-prem option" },
              ]}
            />
          </ZoruPricingTier>
        
</SnippetDemo>
</Section>
<Section step="Step 6" title="Job listing + call-to-action">
<SnippetDemo code={`
          <ZoruJobListing
            jobs={[
              {
                id: "j1",
                company: "SabNode",
                title: "Senior frontend engineer",
                logo: <Briefcase />,
                description:
                  "Lead the zoruui rollout across all modules and own the design-system roadmap.",
                salary: "\$160k – \$200k",
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
                salary: "\$140k – \$180k",
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
                <Button className="bg-[var(--st-text-inverted)] text-[var(--st-text)] hover:bg-[var(--st-text-inverted)]/90">
                  Start the migration
                </Button>
                <Button variant="ghost" className="text-[var(--st-text-inverted)] hover:bg-[var(--st-text-inverted)]/10">
                  Read the plan →
                </Button>
              </>
            }
          />
        `}>

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
                <Button className="bg-[var(--st-text-inverted)] text-[var(--st-text)] hover:bg-[var(--st-text-inverted)]/90">
                  Start the migration
                </Button>
                <Button variant="ghost" className="text-[var(--st-text-inverted)] hover:bg-[var(--st-text-inverted)]/10">
                  Read the plan →
                </Button>
              </>
            }
          />
        
</SnippetDemo>
</Section>
    </div>
  );
}
