import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  StatCard,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { redirect } from "next/navigation";

import {
  // Core icons
  Briefcase,
  Users,
  Wifi,
  Activity,
  CreditCard,
  Receipt,
  // Wachat icons
  MessageSquare,
  Send,
  Inbox,
  BookOpen,
  GitFork,
  PlayCircle,
  Quote,
  FileText,
  // CRM icons
  UserSquare,
  Target,
  HandCoins,
  FileCheck,
  Package,
  Building2,
  Truck,
  ListChecks,
  Zap,
  ClipboardList,
  BookMarked,
  // Ads icons
  Megaphone,
  Share2,
  Users2,
  // Marketing icons
  Mail,
  MessageCircle,
  // Platform icons
  Search,
  BarChart3,
  KeyRound,
  Workflow,
  MessagesSquare,
  Bell,
  Hash,
  // Tools icons
  Link2,
  QrCode,
  Store,
  ShoppingBag,
  Globe,
  ArrowRight,
} from "lucide-react";

import {
  getProjectsForAdmin,
  getAdminDashboardStats,
} from "@/app/actions/admin.actions";
import { getAdminSession } from "@/lib/admin-session";
import { getPlans } from "@/app/actions/plan.actions";
import { rustClient } from "@/lib/rust-client";
import type { Project } from "@/lib/definitions";

import type { Metadata } from "next";
import Link from "next/link";

import { ProjectSearch } from "@/components/20ui-domain/project-search";
import { AdminDeleteProjectButton } from "@/components/20ui-domain/admin-delete-project-button";
import { AdminUpdateCreditsButton } from "@/components/20ui-domain/admin-update-credits-button";
import { AdminUpdateMpsButton } from "@/components/20ui-domain/admin-update-mps-button";
import { AdminAssignPlanDialog } from "@/components/20ui-domain/admin-assign-plan-dialog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin Dashboard | SabNode" };

type ProjectWithPlan = Project & {
  plan?: { name: string };
  planId?: any;
  credits?: number;
  messagesPerSecond?: number;
};

const PROJECTS_PER_PAGE = 8;

const fmt = (n: number) => n.toLocaleString("en-IN");

/* ---------------------------------------------------------------- */
/*                       Reusable stat blocks                         */
/* ---------------------------------------------------------------- */

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <Card padding="sm" className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] border border-[var(--st-border)] flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-[var(--st-text)]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-lg font-bold text-[var(--st-text)] tabular-nums truncate">
          {fmt(value)}
        </div>
        <div className="text-[11px] text-[var(--st-text-secondary)] truncate">{label}</div>
      </div>
    </Card>
  );
}

function StatSection({
  title,
  description,
  icon: Icon,
  items,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  items: Array<{ label: string; value: number; icon: React.ElementType }>;
}) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-[var(--st-radius)] flex items-center justify-center bg-[var(--st-bg-secondary)] border border-[var(--st-border)]">
          <Icon className="h-4 w-4 text-[var(--st-text)]" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--st-text)]">{title}</h2>
          {description && (
            <p className="text-[11px] text-[var(--st-text-secondary)]">{description}</p>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item) => (
          <MiniStat
            key={item.label}
            label={item.label}
            value={item.value}
            icon={item.icon}
          />
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */
/*                              Page                                  */
/* ---------------------------------------------------------------- */

const statusTone: Record<string, BadgeTone> = {
  Completed: "success",
  Queued: "neutral",
  Processing: "info",
  Failed: "danger",
};

import { cache, Suspense } from "react";
import { GrowthChart } from "./growth-chart";

const getCachedStats = cache(getAdminDashboardStats);

function StatsFallback({ title }: { title: string }) {
  return (
    <Card padding="none" className="h-32 flex items-center justify-center animate-pulse text-sm text-[var(--st-text-secondary)]">
      Loading {title}...
    </Card>
  );
}

async function OverviewStatsWrapper() {
  const stats = await getCachedStats();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Users"
        value={fmt(stats.core.totalUsers)}
        icon={Users}
        delta={{ value: `${fmt(stats.core.approvedUsers)} approved, ${fmt(stats.core.pendingUsers)} pending`, tone: "neutral" }}
      />
      <StatCard
        label="Total Projects"
        value={fmt(stats.core.totalProjects)}
        icon={Briefcase}
        delta={{ value: "All project types", tone: "neutral" }}
      />
      <StatCard
        label="Active WABAs"
        value={fmt(stats.core.totalWabas)}
        icon={Wifi}
        delta={{ value: "Connected WhatsApp accounts", tone: "neutral" }}
      />
      <StatCard
        label="System Uptime"
        value="99.98%"
        icon={Activity}
        delta={{ value: "Last 30 days", tone: "up" }}
      />
    </div>
  );
}

async function CoreStatsWrapper() {
  const stats = await getCachedStats();
  return (
    <StatSection
      title="Core Platform"
      description="Users, projects and monetization"
      icon={Activity}
      items={[
        { label: "Users", value: stats.core.totalUsers, icon: Users },
        { label: "Approved", value: stats.core.approvedUsers, icon: Users },
        { label: "Pending", value: stats.core.pendingUsers, icon: Users },
        { label: "Projects", value: stats.core.totalProjects, icon: Briefcase },
        { label: "WABAs", value: stats.core.totalWabas, icon: Wifi },
        { label: "Plans", value: stats.core.totalPlans, icon: CreditCard },
        {
          label: "Transactions",
          value: stats.core.totalTransactions,
          icon: Receipt,
        },
      ]}
    />
  );
}

async function WachatStatsWrapper() {
  const stats = await getCachedStats();
  return (
    <StatSection
      title="WhatsApp (Wachat)"
      description="Messaging, broadcasts, templates and flows"
      icon={MessageSquare}
      items={[
        { label: "Broadcasts", value: stats.wachat.broadcasts, icon: Send },
        {
          label: "Outgoing Messages",
          value: stats.wachat.outgoingMessages,
          icon: Send,
        },
        {
          label: "Incoming Messages",
          value: stats.wachat.incomingMessages,
          icon: Inbox,
        },
        { label: "Contacts", value: stats.wachat.contacts, icon: Users },
        { label: "Templates", value: stats.wachat.templates, icon: FileText },
        {
          label: "Library Templates",
          value: stats.wachat.libraryTemplates,
          icon: BookOpen,
        },
        { label: "Flows", value: stats.wachat.flows, icon: GitFork },
        {
          label: "Flow Executions",
          value: stats.wachat.flowLogs,
          icon: PlayCircle,
        },
        {
          label: "Canned Replies",
          value: stats.wachat.cannedMessages,
          icon: Quote,
        },
        {
          label: "Activity Logs",
          value: stats.wachat.activityLogs,
          icon: ClipboardList,
        },
      ]}
    />
  );
}

async function CrmStatsWrapper() {
  const stats = await getCachedStats();
  return (
    <StatSection
      title="CRM Suite"
      description="Sales, accounting, inventory and HR"
      icon={UserSquare}
      items={[
        { label: "Contacts", value: stats.crm.contacts, icon: UserSquare },
        { label: "Leads", value: stats.crm.leads, icon: Target },
        { label: "Deals", value: stats.crm.deals, icon: HandCoins },
        { label: "Invoices", value: stats.crm.invoices, icon: FileCheck },
        { label: "Quotations", value: stats.crm.quotations, icon: FileText },
        {
          label: "Sales Orders",
          value: stats.crm.salesOrders,
          icon: ShoppingBag,
        },
        {
          label: "Purchase Orders",
          value: stats.crm.purchaseOrders,
          icon: Truck,
        },
        { label: "Expenses", value: stats.crm.expenses, icon: Receipt },
        { label: "Products", value: stats.crm.products, icon: Package },
        { label: "Employees", value: stats.crm.employees, icon: Building2 },
        { label: "Vendors", value: stats.crm.vendors, icon: Truck },
        { label: "Tasks", value: stats.crm.tasks, icon: ListChecks },
        { label: "Automations", value: stats.crm.automations, icon: Zap },
        { label: "Forms", value: stats.crm.forms, icon: FileText },
        {
          label: "Form Submissions",
          value: stats.crm.formSubmissions,
          icon: ClipboardList,
        },
        {
          label: "Voucher Entries",
          value: stats.crm.voucherEntries,
          icon: BookMarked,
        },
      ]}
    />
  );
}

async function AdsStatsWrapper() {
  const stats = await getCachedStats();
  return (
    <StatSection
      title="Ad Manager & Social"
      description="Facebook, Instagram and Meta Ads"
      icon={Megaphone}
      items={[
        {
          label: "Ad Campaigns",
          value: stats.ads.adCampaigns,
          icon: Megaphone,
        },
        {
          label: "FB Broadcasts",
          value: stats.ads.facebookBroadcasts,
          icon: Share2,
        },
        { label: "FB Flows", value: stats.ads.facebookFlows, icon: GitFork },
        {
          label: "FB Subscribers",
          value: stats.ads.facebookSubscribers,
          icon: Users2,
        },
        { label: "Meta Flows", value: stats.ads.metaFlows, icon: Workflow },
      ]}
    />
  );
}

async function MarketingStatsWrapper() {
  const stats = await getCachedStats();
  return (
    <StatSection
      title="Email & SMS Marketing"
      description="Outbound marketing channels"
      icon={Mail}
      items={[
        {
          label: "Email Campaigns",
          value: stats.marketing.emailCampaigns,
          icon: Mail,
        },
        {
          label: "Email Contacts",
          value: stats.marketing.emailContacts,
          icon: Users,
        },
        {
          label: "Email Templates",
          value: stats.marketing.emailTemplates,
          icon: FileText,
        },
        {
          label: "SMS Campaigns",
          value: stats.marketing.smsCampaigns,
          icon: MessageCircle,
        },
        {
          label: "SMS Logs",
          value: stats.marketing.smsLogs,
          icon: ClipboardList,
        },
      ]}
    />
  );
}

async function PlatformStatsWrapper() {
  const stats = await getCachedStats();
  return (
    <StatSection
      title="Platform Modules"
      description="SEO suite, SabFlow, SabChat and notifications"
      icon={Workflow}
      items={[
        {
          label: "SEO Projects",
          value: stats.platform.seoProjects,
          icon: Search,
        },
        {
          label: "SEO Audits",
          value: stats.platform.seoAudits,
          icon: BarChart3,
        },
        {
          label: "SEO Keywords",
          value: stats.platform.seoKeywords,
          icon: KeyRound,
        },
        { label: "SabFlows", value: stats.platform.sabflows, icon: Workflow },
        {
          label: "SabFlow Runs",
          value: stats.platform.sabflowExecutions,
          icon: PlayCircle,
        },
        {
          label: "SabChat Sessions",
          value: stats.platform.sabchatSessions,
          icon: MessagesSquare,
        },
        {
          label: "Team Channels",
          value: stats.platform.teamChannels,
          icon: Hash,
        },
        {
          label: "Team Messages",
          value: stats.platform.teamMessages,
          icon: MessageSquare,
        },
        {
          label: "Team Tasks",
          value: stats.platform.teamTasks,
          icon: ListChecks,
        },
        {
          label: "Notifications",
          value: stats.platform.notifications,
          icon: Bell,
        },
      ]}
    />
  );
}

async function ToolsStatsWrapper() {
  const stats = await getCachedStats();
  return (
    <StatSection
      title="Tools & Builder"
      description="URL shortener, QR codes and e-commerce"
      icon={Link2}
      items={[
        { label: "Short URLs", value: stats.tools.shortUrls, icon: Link2 },
        { label: "QR Codes", value: stats.tools.qrCodes, icon: QrCode },
        { label: "Ecomm Shops", value: stats.tools.ecommShops, icon: Store },
        {
          label: "Ecomm Products",
          value: stats.tools.ecommProducts,
          icon: Package,
        },
        {
          label: "Ecomm Orders",
          value: stats.tools.ecommOrders,
          icon: ShoppingBag,
        },
        {
          label: "Website Pages",
          value: stats.tools.websitePages,
          icon: Globe,
        },
      ]}
    />
  );
}

async function ProjectsTableWrapper({
  currentPage,
  query,
}: {
  currentPage: number;
  query: string;
}) {
  const [projectData, allPlans] = await Promise.all([
    getProjectsForAdmin(currentPage, PROJECTS_PER_PAGE, query).catch(() => ({
      projects: [],
      total: 0,
    })),
    getPlans().catch(() => []),
  ]);
  const { projects, total: totalProjects } = projectData;
  const totalPages = Math.ceil(totalProjects / PROJECTS_PER_PAGE);
  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;
  const prevHref = `/admin/dashboard?page=${currentPage - 1}${query ? `&query=${query}` : ""}`;
  const nextHref = `/admin/dashboard?page=${currentPage + 1}${query ? `&query=${query}` : ""}`;

  return (
    <Card padding="none" className="lg:col-span-3 overflow-hidden">
      <CardHeader className="flex items-center justify-between gap-4">
        <div>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>{fmt(totalProjects)} total</CardDescription>
        </div>
        <div className="w-56">
          <ProjectSearch placeholder="Search projects..." />
        </div>
      </CardHeader>
      <CardBody className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th>Project</Th>
                <Th>Plan</Th>
                <Th>Credits</Th>
                <Th>MPS</Th>
                <Th align="right" aria-label="Actions" />
              </Tr>
            </THead>
            <TBody>
              {projects.length > 0 ? (
                projects.map((project: ProjectWithPlan) => (
                  <Tr key={project._id.toString()}>
                    <Td className="font-medium text-[var(--st-text)]">
                      {project.name}
                    </Td>
                    <Td>
                      <Badge tone="neutral">{project.plan?.name || "N/A"}</Badge>
                    </Td>
                    <Td className="tabular-nums">
                      {project.credits?.toLocaleString() ?? 0}
                    </Td>
                    <Td className="tabular-nums">
                      {project.messagesPerSecond ?? "-"}
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <AdminUpdateCreditsButton
                          projectId={project._id.toString()}
                          currentCredits={project.credits || 0}
                        />
                        <AdminUpdateMpsButton
                          projectId={project._id.toString()}
                          currentMps={project.messagesPerSecond || 80}
                        />
                        <AdminAssignPlanDialog
                          projectId={project._id.toString()}
                          projectName={project.name}
                          currentPlanId={project.planId?.toString()}
                          allPlans={allPlans}
                        />
                        <AdminDeleteProjectButton
                          projectId={project._id.toString()}
                          projectName={project.name}
                        />
                      </div>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={5} className="py-12">
                    <EmptyState
                      icon={Briefcase}
                      title="No projects found"
                      description="No projects match the current filters. New projects will appear here."
                    />
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
        </div>
      </CardBody>
      <CardFooter className="flex items-center justify-between">
        <span className="text-xs text-[var(--st-text-secondary)]">
          Page {currentPage} of {totalPages > 0 ? totalPages : 1}
        </span>
        <div className="flex gap-2">
          {prevDisabled ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Link href={prevHref}>
              <Button variant="outline" size="sm">
                Previous
              </Button>
            </Link>
          )}
          {nextDisabled ? (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          ) : (
            <Link href={nextHref}>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </Link>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

async function RecentBroadcastsWrapper() {
  const broadcastData = await rustClient.admin.stats
    .listBroadcasts({ page: 1, limit: 6 })
    .catch(() => ({ broadcasts: [], total: 0 }));
  const recentBroadcasts = broadcastData.broadcasts;

  return (
    <Card padding="none" className="lg:col-span-2 overflow-hidden">
      <CardHeader>
        <CardTitle>Recent Broadcasts</CardTitle>
        <CardDescription>Latest campaigns across the platform</CardDescription>
      </CardHeader>
      <CardBody className="p-0 divide-y divide-[var(--st-border)]">
        {recentBroadcasts.length > 0 ? (
          recentBroadcasts.map((b: any) => {
            const tone = statusTone[b.status] ?? statusTone["Queued"];
            return (
              <div
                key={b._id.toString()}
                className="px-6 py-3 flex items-center gap-3 hover:bg-[var(--st-bg-secondary)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--st-text)] truncate">
                    {b.templateName || "Unknown template"}
                  </p>
                  <p className="text-xs text-[var(--st-text-secondary)]">
                    {new Date(b.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge tone={tone} dot className="shrink-0 capitalize">
                  {b.status?.toLowerCase() || "unknown"}
                </Badge>
              </div>
            );
          })
        ) : (
          <div className="px-6 py-12">
            <EmptyState
              icon={Send}
              title="No broadcasts yet"
              description="Campaigns sent across the platform will show up here."
            />
          </div>
        )}
      </CardBody>
      <CardFooter>
        <Link
          href="/admin/dashboard/broadcast-log"
          className="inline-flex items-center gap-1 text-xs text-[var(--st-text)] hover:text-[var(--st-text-secondary)] font-medium transition-colors"
        >
          View all broadcasts
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </CardFooter>
    </Card>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ query?: string; page?: string }>;
}) {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) redirect("/admin-login");

  const sp = await searchParams;
  const query = sp?.query || "";
  const currentPage = Number(sp?.page) || 1;

  return (
    <div className="space-y-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Dashboard</PageTitle>
          <PageDescription>
            Platform-wide overview. All users, all modules.
          </PageDescription>
        </PageHeaderHeading>
        <PageActions className="hidden sm:flex flex-col items-end gap-0.5">
          <span className="text-xs text-[var(--st-text-secondary)]">Total data points</span>
          <span className="text-sm font-semibold text-[var(--st-text)]">Live</span>
        </PageActions>
      </PageHeader>

      <Suspense fallback={<StatsFallback title="Overview" />}>
        <OverviewStatsWrapper />
      </Suspense>

      <Suspense fallback={<StatsFallback title="Core Stats" />}>
        <CoreStatsWrapper />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GrowthChart />
        <Suspense fallback={<StatsFallback title="Recent Broadcasts" />}>
          <RecentBroadcastsWrapper />
        </Suspense>
      </div>

      <Suspense fallback={<StatsFallback title="WhatsApp Stats" />}>
        <WachatStatsWrapper />
      </Suspense>

      <Suspense fallback={<StatsFallback title="CRM Stats" />}>
        <CrmStatsWrapper />
      </Suspense>

      <Suspense fallback={<StatsFallback title="Ad Manager Stats" />}>
        <AdsStatsWrapper />
      </Suspense>

      <Suspense fallback={<StatsFallback title="Marketing Stats" />}>
        <MarketingStatsWrapper />
      </Suspense>

      <Suspense fallback={<StatsFallback title="Platform Stats" />}>
        <PlatformStatsWrapper />
      </Suspense>

      <Suspense fallback={<StatsFallback title="Tools Stats" />}>
        <ToolsStatsWrapper />
      </Suspense>

      <Suspense
        fallback={
          <Card padding="none" className="h-96 flex items-center justify-center animate-pulse text-sm text-[var(--st-text-secondary)]">
            Loading projects...
          </Card>
        }
      >
        <ProjectsTableWrapper currentPage={currentPage} query={query} />
      </Suspense>
    </div>
  );
}
