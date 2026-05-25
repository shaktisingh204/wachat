import re

with open("src/app/admin/dashboard/page.tsx", "r") as f:
    content = f.read()

# 1. Add imports
import_cache = "import { cache, Suspense } from 'react';\nimport { GrowthChart } from './growth-chart';\n"
content = content.replace("import { Suspense } from 'react';", import_cache)

# 2. Add ProjectWithPlan type
type_def = """type ProjectWithPlan = Project & { plan?: { name: string }, planId?: any, credits?: number, messagesPerSecond?: number };"""
content = content.replace("const PROJECTS_PER_PAGE = 8;", type_def + "\n\nconst PROJECTS_PER_PAGE = 8;")

# 3. Replace Project type in projects mapping
content = content.replace("projects.map((project) => (", "projects.map((project: ProjectWithPlan) => (")
content = content.replace("{(project as any).plan?.name || 'N/A'}", "{project.plan?.name || 'N/A'}")

# 4. Break StatsGridWrapper into multiple wrappers
stats_wrappers = """const getCachedStats = cache(getAdminDashboardStats);

function StatsFallback({ title }: { title: string }) {
    return (
        <div className="h-32 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center animate-pulse text-sm text-slate-500">
            Loading {title}...
        </div>
    );
}

async function OverviewStatsWrapper() {
    const stats = await getCachedStats();
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HeroStat title="Total Users" value={fmt(stats.core.totalUsers)} icon={Users} sub={`${fmt(stats.core.approvedUsers)} approved · ${fmt(stats.core.pendingUsers)} pending`} />
            <HeroStat title="Total Projects" value={fmt(stats.core.totalProjects)} icon={Briefcase} sub="All project types" />
            <HeroStat title="Active WABAs" value={fmt(stats.core.totalWabas)} icon={Wifi} sub="Connected WhatsApp accounts" />
            <HeroStat title="System Uptime" value="99.98%" icon={Activity} sub="Last 30 days" accent />
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
                { label: 'Users', value: stats.core.totalUsers, icon: Users },
                { label: 'Approved', value: stats.core.approvedUsers, icon: Users },
                { label: 'Pending', value: stats.core.pendingUsers, icon: Users },
                { label: 'Projects', value: stats.core.totalProjects, icon: Briefcase },
                { label: 'WABAs', value: stats.core.totalWabas, icon: Wifi },
                { label: 'Plans', value: stats.core.totalPlans, icon: CreditCard },
                { label: 'Transactions', value: stats.core.totalTransactions, icon: Receipt },
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
                { label: 'Broadcasts', value: stats.wachat.broadcasts, icon: Send },
                { label: 'Outgoing Messages', value: stats.wachat.outgoingMessages, icon: Send },
                { label: 'Incoming Messages', value: stats.wachat.incomingMessages, icon: Inbox },
                { label: 'Contacts', value: stats.wachat.contacts, icon: Users },
                { label: 'Templates', value: stats.wachat.templates, icon: FileText },
                { label: 'Library Templates', value: stats.wachat.libraryTemplates, icon: BookOpen },
                { label: 'Flows', value: stats.wachat.flows, icon: GitFork },
                { label: 'Flow Executions', value: stats.wachat.flowLogs, icon: PlayCircle },
                { label: 'Canned Replies', value: stats.wachat.cannedMessages, icon: Quote },
                { label: 'Activity Logs', value: stats.wachat.activityLogs, icon: ClipboardList },
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
                { label: 'Contacts', value: stats.crm.contacts, icon: UserSquare },
                { label: 'Leads', value: stats.crm.leads, icon: Target },
                { label: 'Deals', value: stats.crm.deals, icon: HandCoins },
                { label: 'Invoices', value: stats.crm.invoices, icon: FileCheck },
                { label: 'Quotations', value: stats.crm.quotations, icon: FileText },
                { label: 'Sales Orders', value: stats.crm.salesOrders, icon: ShoppingBag },
                { label: 'Purchase Orders', value: stats.crm.purchaseOrders, icon: Truck },
                { label: 'Expenses', value: stats.crm.expenses, icon: Receipt },
                { label: 'Products', value: stats.crm.products, icon: Package },
                { label: 'Employees', value: stats.crm.employees, icon: Building2 },
                { label: 'Vendors', value: stats.crm.vendors, icon: Truck },
                { label: 'Tasks', value: stats.crm.tasks, icon: ListChecks },
                { label: 'Automations', value: stats.crm.automations, icon: Zap },
                { label: 'Forms', value: stats.crm.forms, icon: FileText },
                { label: 'Form Submissions', value: stats.crm.formSubmissions, icon: ClipboardList },
                { label: 'Voucher Entries', value: stats.crm.voucherEntries, icon: BookMarked },
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
                { label: 'Ad Campaigns', value: stats.ads.adCampaigns, icon: Megaphone },
                { label: 'FB Broadcasts', value: stats.ads.facebookBroadcasts, icon: Share2 },
                { label: 'FB Flows', value: stats.ads.facebookFlows, icon: GitFork },
                { label: 'FB Subscribers', value: stats.ads.facebookSubscribers, icon: Users2 },
                { label: 'Meta Flows', value: stats.ads.metaFlows, icon: Workflow },
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
                { label: 'Email Campaigns', value: stats.marketing.emailCampaigns, icon: Mail },
                { label: 'Email Contacts', value: stats.marketing.emailContacts, icon: Users },
                { label: 'Email Templates', value: stats.marketing.emailTemplates, icon: FileText },
                { label: 'SMS Campaigns', value: stats.marketing.smsCampaigns, icon: MessageCircle },
                { label: 'SMS Logs', value: stats.marketing.smsLogs, icon: ClipboardList },
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
                { label: 'SEO Projects', value: stats.platform.seoProjects, icon: Search },
                { label: 'SEO Audits', value: stats.platform.seoAudits, icon: BarChart3 },
                { label: 'SEO Keywords', value: stats.platform.seoKeywords, icon: KeyRound },
                { label: 'SabFlows', value: stats.platform.sabflows, icon: Workflow },
                { label: 'SabFlow Runs', value: stats.platform.sabflowExecutions, icon: PlayCircle },
                { label: 'SabChat Sessions', value: stats.platform.sabchatSessions, icon: MessagesSquare },
                { label: 'Team Channels', value: stats.platform.teamChannels, icon: Hash },
                { label: 'Team Messages', value: stats.platform.teamMessages, icon: MessageSquare },
                { label: 'Team Tasks', value: stats.platform.teamTasks, icon: ListChecks },
                { label: 'Notifications', value: stats.platform.notifications, icon: Bell },
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
                { label: 'Short URLs', value: stats.tools.shortUrls, icon: Link2 },
                { label: 'QR Codes', value: stats.tools.qrCodes, icon: QrCode },
                { label: 'Ecomm Shops', value: stats.tools.ecommShops, icon: Store },
                { label: 'Ecomm Products', value: stats.tools.ecommProducts, icon: Package },
                { label: 'Ecomm Orders', value: stats.tools.ecommOrders, icon: ShoppingBag },
                { label: 'Website Pages', value: stats.tools.websitePages, icon: Globe },
            ]}
        />
    );
}
"""
start_idx = content.find("async function StatsGridWrapper()")
end_idx = content.find("async function ProjectsTableWrapper", start_idx)
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + stats_wrappers + "\n" + content[end_idx:]


# 5. Modify the render in AdminDashboardPage
render_original = """            <Suspense fallback={<div className="h-48 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center animate-pulse text-sm text-slate-500">Loading comprehensive stats...</div>}>
                <StatsGridWrapper />
            </Suspense>"""

render_new = """            <Suspense fallback={<StatsFallback title="Overview" />}>
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
            </Suspense>"""

content = content.replace(render_original, render_new)

# 6. Change grid for RecentBroadcastsWrapper since we put it up with GrowthChart
# Wait, ProjectsTableWrapper is below.
projects_original = """            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <Suspense fallback={<div className="lg:col-span-3 h-96 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center animate-pulse text-sm text-slate-500">Loading projects...</div>}>
                    <ProjectsTableWrapper currentPage={currentPage} query={query} />
                </Suspense>

                <Suspense fallback={<div className="lg:col-span-2 h-96 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center animate-pulse text-sm text-slate-500">Loading broadcasts...</div>}>
                    <RecentBroadcastsWrapper />
                </Suspense>
            </div>"""

projects_new = """            <Suspense fallback={<div className="h-96 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center animate-pulse text-sm text-slate-500">Loading projects...</div>}>
                <ProjectsTableWrapper currentPage={currentPage} query={query} />
            </Suspense>"""

content = content.replace(projects_original, projects_new)

with open("src/app/admin/dashboard/page.tsx", "w") as f:
    f.write(content)

