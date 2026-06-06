import { Button } from '@/components/sabcrm/20ui/compat';
import { redirect } from "next/navigation";
import type { WithId } from "mongodb";

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
} from "lucide-react";

import {
  getProjectsForAdmin,
  getAdminDashboardStats,
  type AdminStats,
} from "@/app/actions/admin.actions";
import { getAdminSession } from "@/lib/admin-session";
import { getPlans } from "@/app/actions/plan.actions";
import { rustClient } from "@/lib/rust-client";
import type { Project } from "@/lib/definitions";

import type { Metadata } from "next";
import Link from "next/link";

import { ProjectSearch } from "@/components/zoruui-domain/project-search";
import { AdminDeleteProjectButton } from "@/components/zoruui-domain/admin-delete-project-button";
import { AdminUpdateCreditsButton } from "@/components/zoruui-domain/admin-update-credits-button";
import { AdminUpdateMpsButton } from "@/components/zoruui-domain/admin-update-mps-button";
import { AdminAssignPlanDialog } from "@/components/zoruui-domain/admin-assign-plan-dialog";

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

function HeroStat({
  title,
  value,
  icon: Icon,
  sub,
  accent = false,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider">
          {title}
        </span>
        <div
          className={`h-8 w-8 rounded-lg flex items-center justify-center ${accent ? "bg-[var(--st-bg-muted)] border border-[var(--st-border)]" : "bg-[var(--st-bg-secondary)]"}`}
        >
          <Icon
            className={`h-4 w-4 ${accent ? "text-[var(--st-text)]" : "text-[var(--st-text)]"}`}
          />
        </div>
      </div>
      <div>
        <div
          className={`text-3xl font-bold tracking-tight ${accent ? "text-[var(--st-text)]" : "text-[var(--st-text)]"}`}
        >
          {value}
        </div>
        {sub && <p className="text-xs text-[var(--st-text-secondary)] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

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
    <div className="rounded-xl border border-[var(--st-border)] bg-[var(--st-bg)] p-4 flex items-center gap-3 hover:border-[var(--st-border)] hover:bg-[var(--st-bg)] transition-all">
      <div className="h-9 w-9 rounded-xl bg-[var(--st-bg-secondary)] border border-[var(--st-border)] flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-[var(--st-text)]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-lg font-bold text-[var(--st-text)] tabular-nums truncate">
          {fmt(value)}
        </div>
        <div className="text-[11px] text-[var(--st-text-secondary)] truncate">{label}</div>
      </div>
    </div>
  );
}

function StatSection({
  title,
  description,
  icon: Icon,
  accent,
  items,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  accent: string; // tailwind color like 'emerald' | 'sky' | 'violet'
  items: Array<{ label: string; value: number; icon: React.ElementType }>;
}) {
  // Map accent to concrete class strings (Tailwind JIT-safe)
  const accentClasses: Record<
    string,
    { bg: string; text: string; border: string }
  > = {
    emerald: {
      bg: "bg-[var(--st-bg-muted)]",
      text: "text-[var(--st-text)]",
      border: "border-[var(--st-border)]",
    },
    sky: { bg: "bg-[var(--st-bg-muted)]", text: "text-[var(--st-text)]", border: "border-[var(--st-border)]" },
    violet: {
      bg: "bg-[var(--st-bg-muted)]",
      text: "text-[var(--st-text)]",
      border: "border-[var(--st-border)]",
    },
    rose: {
      bg: "bg-[var(--st-bg-muted)]",
      text: "text-[var(--st-text)]",
      border: "border-[var(--st-border)]",
    },
    amber: {
      bg: "bg-[var(--st-bg-muted)]",
      text: "text-[var(--st-text)]",
      border: "border-[var(--st-border)]",
    },
    cyan: {
      bg: "bg-[var(--st-bg-muted)]",
      text: "text-[var(--st-text)]",
      border: "border-[var(--st-border)]",
    },
  };
  const c = accentClasses[accent] ?? accentClasses.emerald;

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`h-9 w-9 rounded-xl flex items-center justify-center ${c.bg} border ${c.border}`}
        >
          <Icon className={`h-4 w-4 ${c.text}`} />
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

const statusVariant: Record<string, string> = {
  Completed: "bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]",
  Queued: "bg-[var(--st-bg-secondary)] text-[var(--st-text)] border-[var(--st-border)]",
  Processing: "bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]",
  Failed: "bg-[var(--st-text)]/15 text-[var(--st-text)] border-[var(--st-border)]/30",
};

import { cache, Suspense } from "react";
import { GrowthChart } from "./growth-chart";

const getCachedStats = cache(getAdminDashboardStats);

function StatsFallback({ title }: { title: string }) {
  return (
    <div className="h-32 rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-center animate-pulse text-sm text-[var(--st-text-secondary)]">
      Loading {title}...
    </div>
  );
}

async function OverviewStatsWrapper() {
  const stats = await getCachedStats();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <HeroStat
        title="Total Users"
        value={fmt(stats.core.totalUsers)}
        icon={Users}
        sub={`${fmt(stats.core.approvedUsers)} approved · ${fmt(stats.core.pendingUsers)} pending`}
      />
      <HeroStat
        title="Total Projects"
        value={fmt(stats.core.totalProjects)}
        icon={Briefcase}
        sub="All project types"
      />
      <HeroStat
        title="Active WABAs"
        value={fmt(stats.core.totalWabas)}
        icon={Wifi}
        sub="Connected WhatsApp accounts"
      />
      <HeroStat
        title="System Uptime"
        value="99.98%"
        icon={Activity}
        sub="Last 30 days"
        accent
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
      accent="amber"
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
      accent="emerald"
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
      accent="sky"
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
      accent="violet"
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
      accent="rose"
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
      accent="cyan"
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
      accent="emerald"
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

  return (
    <div className="lg:col-span-3 rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--st-border)] flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-[var(--st-text)]">All Projects</h2>
          <p className="text-xs text-[var(--st-text-secondary)] mt-0.5">
            {fmt(totalProjects)} total
          </p>
        </div>
        <div className="w-56">
          <ProjectSearch placeholder="Search projects…" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--st-border)]">
              <th className="text-left px-6 py-3 text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider">
                Project
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider">
                Plan
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider">
                Credits
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider">
                MPS
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--st-border)]">
            {projects.length > 0 ? (
              projects.map((project: ProjectWithPlan) => (
                <tr
                  key={project._id.toString()}
                  className="hover:bg-[var(--st-bg-secondary)] transition-colors"
                >
                  <td className="px-6 py-3 font-medium text-[var(--st-text)]">
                    {project.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--st-text)]">
                      {project.plan?.name || "N/A"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--st-text)] tabular-nums">
                    {project.credits?.toLocaleString() ?? 0}
                  </td>
                  <td className="px-4 py-3 text-[var(--st-text)] tabular-nums">
                    {project.messagesPerSecond ?? "—"}
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-[var(--st-text-secondary)]"
                >
                  No projects found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 border-t border-[var(--st-border)] flex items-center justify-between">
        <span className="text-xs text-[var(--st-text-secondary)]">
          Page {currentPage} of {totalPages > 0 ? totalPages : 1}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            disabled={currentPage <= 1}
            className="border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] disabled:opacity-40"
          >
            <Link
              href={`/admin/dashboard?page=${currentPage - 1}${query ? `&query=${query}` : ""}`}
            >
              Previous
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            disabled={currentPage >= totalPages}
            className="border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] disabled:opacity-40"
          >
            <Link
              href={`/admin/dashboard?page=${currentPage + 1}${query ? `&query=${query}` : ""}`}
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

async function RecentBroadcastsWrapper() {
  const broadcastData = await rustClient.admin.stats
    .listBroadcasts({ page: 1, limit: 6 })
    .catch(() => ({ broadcasts: [], total: 0 }));
  const recentBroadcasts = broadcastData.broadcasts;

  return (
    <div className="lg:col-span-2 rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--st-border)]">
        <h2 className="font-semibold text-[var(--st-text)]">Recent Broadcasts</h2>
        <p className="text-xs text-[var(--st-text-secondary)] mt-0.5">
          Latest campaigns across the platform
        </p>
      </div>
      <div className="divide-y divide-[var(--st-border)]">
        {recentBroadcasts.length > 0 ? (
          recentBroadcasts.map((b: any) => {
            const statusClass =
              statusVariant[b.status] ?? statusVariant["Queued"];
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
                <span
                  className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusClass}`}
                >
                  {b.status?.toLowerCase() || "unknown"}
                </span>
              </div>
            );
          })
        ) : (
          <div className="px-6 py-12 text-center text-[var(--st-text-secondary)] text-sm">
            No broadcasts yet.
          </div>
        )}
      </div>
      <div className="px-6 py-3 border-t border-[var(--st-border)]">
        <Link
          href="/admin/dashboard/broadcast-log"
          className="text-xs text-[var(--st-text)] hover:text-[var(--st-text-secondary)] font-medium transition-colors"
        >
          View all broadcasts →
        </Link>
      </div>
    </div>
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
      {/* Page header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--st-text)]">Dashboard</h1>
          <p className="text-sm text-[var(--st-text-secondary)] mt-1">
            Platform-wide overview — all users, all modules.
          </p>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-xs text-[var(--st-text-secondary)]">Total data points</div>
          <div className="text-sm font-semibold text-[var(--st-text)]">Live</div>
        </div>
      </div>

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
          <div className="h-96 rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-center animate-pulse text-sm text-[var(--st-text-secondary)]">
            Loading projects...
          </div>
        }
      >
        <ProjectsTableWrapper currentPage={currentPage} query={query} />
      </Suspense>
    </div>
  );
}
