"use client";

import React, { useState } from "react";
import {
  Users,
  Activity,
  AlertTriangle,
  Calendar,
  BookOpen,
  ChevronRight,
  Search,
  Filter,
  Plus,
  MoreVertical,
  Clock,
  CheckCircle,
  BarChart2,
  FileText,
  Zap,
  ShieldAlert,
  UserCheck,
  HeartPulse,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Settings,
  Bell,
  Star,
  PlayCircle,
  Download,
  Eye,
  ArrowRight,
} from "lucide-react";

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  StatCard,
  Badge,
  type BadgeTone,
  Field,
  Input,
  Progress,
  type Ui20ProgressTone,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Avatar,
  AvatarImage,
  AvatarFallback,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/sabcrm/20ui";

// --- MOCK DATA ---
const ACCOUNTS_DATA = [
  { id: 1, name: "Acme Corp", plan: "Enterprise", mrr: 12500, healthScore: 92, trend: "up", lastContact: "2 days ago", csm: "Sarah Jenkins", logo: "AC" },
  { id: 2, name: "Stark Industries", plan: "Enterprise", mrr: 45000, healthScore: 45, trend: "down", lastContact: "1 week ago", csm: "John Doe", logo: "SI" },
  { id: 3, name: "Wayne Enterprises", plan: "Pro", mrr: 8500, healthScore: 78, trend: "stable", lastContact: "3 days ago", csm: "Sarah Jenkins", logo: "WE" },
  { id: 4, name: "Cyberdyne Systems", plan: "Enterprise", mrr: 22000, healthScore: 31, trend: "down", lastContact: "2 weeks ago", csm: "Michael Scott", logo: "CS" },
  { id: 5, name: "Umbrella Corp", plan: "Pro", mrr: 5400, healthScore: 88, trend: "up", lastContact: "1 day ago", csm: "John Doe", logo: "UC" },
  { id: 6, name: "Massive Dynamic", plan: "Enterprise", mrr: 31000, healthScore: 95, trend: "up", lastContact: "4 hours ago", csm: "Sarah Jenkins", logo: "MD" },
  { id: 7, name: "Globex", plan: "Starter", mrr: 1200, healthScore: 62, trend: "down", lastContact: "5 days ago", csm: "Michael Scott", logo: "GL" },
  { id: 8, name: "Soylent Corp", plan: "Pro", mrr: 6700, healthScore: 81, trend: "stable", lastContact: "1 week ago", csm: "John Doe", logo: "SC" },
  { id: 9, name: "Initech", plan: "Starter", mrr: 900, healthScore: 22, trend: "down", lastContact: "1 month ago", csm: "Michael Scott", logo: "IN" },
  { id: 10, name: "Goliath National Bank", plan: "Enterprise", mrr: 18000, healthScore: 89, trend: "up", lastContact: "2 days ago", csm: "Sarah Jenkins", logo: "GN" },
];

const CHURN_RISKS = [
  { id: 101, account: "Stark Industries", reason: "Low Adoption - Feature X", severity: "High", daysAtRisk: 14, status: "Investigating", mrr: 45000 },
  { id: 102, account: "Cyberdyne Systems", reason: "Executive Sponsor Left", severity: "Critical", daysAtRisk: 3, status: "Action Required", mrr: 22000 },
  { id: 103, account: "Initech", reason: "Multiple Support Escalations", severity: "Medium", daysAtRisk: 21, status: "Monitoring", mrr: 900 },
  { id: 104, account: "Globex", reason: "Invoice Past Due", severity: "Medium", daysAtRisk: 7, status: "Contacted", mrr: 1200 },
];

const QBR_SCHEDULE = [
  { id: 201, account: "Acme Corp", date: "2026-06-15", time: "10:00 AM", status: "Scheduled", owner: "Sarah Jenkins", type: "Annual" },
  { id: 202, account: "Wayne Enterprises", date: "2026-06-18", time: "02:00 PM", status: "Pending Confirmation", owner: "Sarah Jenkins", type: "Quarterly" },
  { id: 203, account: "Massive Dynamic", date: "2026-06-22", time: "11:30 AM", status: "Scheduled", owner: "Sarah Jenkins", type: "Quarterly" },
  { id: 204, account: "Stark Industries", date: "2026-06-01", time: "01:00 PM", status: "Completed", owner: "John Doe", type: "Emergency" },
];

const PLAYBOOKS = [
  { id: 301, name: "New Enterprise Onboarding", description: "Standard 30-60-90 day onboarding flow for Enterprise.", triggers: "Contract Signed", successRate: 94, activeRuns: 12 },
  { id: 302, name: "Low Adoption Recovery", description: "Engagement sequence for accounts with under 30% MAU.", triggers: "Health Score < 50", successRate: 68, activeRuns: 5 },
  { id: 303, name: "Executive Sponsor Transition", description: "Steps to secure new championship when sponsor leaves.", triggers: "Contact Role Change", successRate: 45, activeRuns: 2 },
  { id: 304, name: "QBR Preparation", description: "Automated data collection and presentation template generation.", triggers: "90 days since last QBR", successRate: 100, activeRuns: 8 },
  { id: 305, name: "Renewal Risk Mitigation", description: "Intensive 60-day sequence for at-risk renewals.", triggers: "Renewal < 90 days & Risk High", successRate: 72, activeRuns: 3 },
];

// --- HELPERS ---

/** Map a health score to a 20ui progress tone. */
function healthTone(score: number): Ui20ProgressTone {
  if (score < 40) return "danger";
  if (score < 70) return "warning";
  return "success";
}

const HealthScoreIndicator = ({ score }: { score: number }) => {
  const tone = healthTone(score);
  const textClass =
    score >= 70
      ? "text-[var(--st-status-ok)]"
      : score >= 40
        ? "text-[var(--st-warn)]"
        : "text-[var(--st-danger)]";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <Progress value={score} tone={tone} size="sm" aria-label={`Health score ${score}`} />
      </div>
      <span className={`text-sm font-semibold w-8 text-right ${textClass}`}>{score}</span>
    </div>
  );
};

// --- SUBVIEWS ---

const OverviewTab = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard label="Total ARR Managed" value="$151,200" icon={DollarSign} delta={{ value: "+12.5%", tone: "up" }} accent="var(--st-status-ok)" />
      <StatCard label="Avg. Health Score" value="68.4" icon={HeartPulse} delta={{ value: "-2.1%", tone: "down" }} accent="var(--st-accent)" />
      <StatCard label="Accounts at Risk" value="4" icon={ShieldAlert} delta={{ value: "+1", tone: "down" }} accent="var(--st-danger)" />
      <StatCard label="Upcoming QBRs" value="3" icon={Calendar} delta={{ value: "Next 30 days", tone: "neutral" }} accent="var(--st-warn)" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card variant="elevated" padding="lg" className="lg:col-span-2">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Health Score Distribution</CardTitle>
          <Button variant="ghost" size="sm" iconRight={ChevronRight}>
            View Details
          </Button>
        </CardHeader>
        <CardBody>
          <div className="h-64 flex items-end justify-between gap-2">
            {[12, 5, 8, 15, 22, 35, 45, 60, 85, 40].map((val, i) => (
              <div key={i} className="w-full flex flex-col items-center group relative">
                <div
                  className={`w-full rounded-t-[var(--st-radius-sm)] transition-all duration-500 ${
                    i < 3
                      ? "bg-[var(--st-danger)]"
                      : i < 6
                        ? "bg-[var(--st-warn)]"
                        : "bg-[var(--st-status-ok)]"
                  }`}
                  style={{ height: `${val}%` }}
                />
                <span className="text-[10px] text-[var(--st-text-tertiary)] mt-2 block">{i * 10}</span>
                <div className="opacity-0 group-hover:opacity-100 absolute -top-10 bg-[var(--st-bg)] border border-[var(--st-border)] text-[var(--st-text)] text-xs py-1 px-2 rounded-[var(--st-radius)] pointer-events-none transition-opacity whitespace-nowrap z-10">
                  {val} accounts
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card variant="elevated" padding="lg">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <IconButton label="More activity options" icon={MoreVertical} size="sm" />
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {[
              { title: "QBR Completed", desc: "Stark Industries", time: "2 hours ago", icon: CheckCircle, tone: "var(--st-status-ok)" },
              { title: "Risk Alert Triggered", desc: "Cyberdyne Systems", time: "5 hours ago", icon: AlertTriangle, tone: "var(--st-danger)" },
              { title: "Playbook Activated", desc: "New Enterprise Onboarding", time: "1 day ago", icon: PlayCircle, tone: "var(--st-accent)" },
              { title: "NPS Survey Received", desc: "Acme Corp (Score: 9)", time: "2 days ago", icon: Star, tone: "var(--st-warn)" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                <span
                  className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
                  style={{ background: `color-mix(in srgb, ${item.tone} 12%, transparent)`, color: item.tone }}
                  aria-hidden="true"
                >
                  <item.icon className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <h4 className="text-sm font-medium text-[var(--st-text)] truncate">{item.title}</h4>
                    <span className="text-xs text-[var(--st-text-tertiary)] shrink-0">{item.time}</span>
                  </div>
                  <p className="text-sm text-[var(--st-text-secondary)] truncate">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  </div>
);

const AccountHealthTab = () => (
  <div className="space-y-6">
    <div className="flex flex-col sm:flex-row justify-between gap-4">
      <div className="flex-1 max-w-md">
        <Field label="Search accounts">
          <Input type="text" placeholder="Search accounts..." iconLeft={Search} />
        </Field>
      </div>
      <div className="flex gap-3 sm:items-end">
        <Button variant="outline" iconLeft={Filter}>
          Filters
        </Button>
        <Button variant="primary" iconLeft={Plus}>
          Add Account
        </Button>
      </div>
    </div>

    <Card variant="outlined" padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table hover>
          <THead>
            <Tr>
              <Th>Account</Th>
              <Th>Plan &amp; MRR</Th>
              <Th width="25%">Health Score</Th>
              <Th>Last Contact</Th>
              <Th>CSM</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {ACCOUNTS_DATA.map((account) => (
              <Tr key={account.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] border border-[var(--st-border)] flex items-center justify-center text-sm font-bold text-[var(--st-accent)]">
                      {account.logo}
                    </span>
                    <div>
                      <div className="font-medium text-[var(--st-text)] flex items-center">
                        {account.name}
                        {account.trend === "up" && <TrendingUp className="w-3 h-3 text-[var(--st-status-ok)] ml-2" aria-hidden="true" />}
                        {account.trend === "down" && <TrendingDown className="w-3 h-3 text-[var(--st-danger)] ml-2" aria-hidden="true" />}
                      </div>
                      <div className="text-xs text-[var(--st-text-tertiary)] mt-0.5">ID: ACC-{account.id.toString().padStart(4, "0")}</div>
                    </div>
                  </div>
                </Td>
                <Td>
                  <div className="text-sm font-medium text-[var(--st-text)] mb-1">${account.mrr.toLocaleString()}/mo</div>
                  <Badge tone={account.plan === "Enterprise" ? "accent" : account.plan === "Pro" ? "info" : "neutral"}>
                    {account.plan}
                  </Badge>
                </Td>
                <Td>
                  <HealthScoreIndicator score={account.healthScore} />
                </Td>
                <Td>
                  <div className="flex items-center text-sm text-[var(--st-text-secondary)]">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-[var(--st-text-tertiary)]" aria-hidden="true" />
                    {account.lastContact}
                  </div>
                </Td>
                <Td>
                  <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
                    <Avatar name={account.csm} size="sm" shape="round" />
                    <span>{account.csm}</span>
                  </div>
                </Td>
                <Td align="right">
                  <IconButton label={`Actions for ${account.name}`} icon={MoreVertical} size="sm" />
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
      <div className="p-4 border-t border-[var(--st-border)] flex items-center justify-between text-sm text-[var(--st-text-secondary)]">
        <span>Showing 1 to 10 of 42 accounts</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm">Previous</Button>
          <Button variant="primary" size="sm">1</Button>
          <Button variant="ghost" size="sm">2</Button>
          <Button variant="ghost" size="sm">3</Button>
          <span className="px-2 py-1 text-[var(--st-text-tertiary)]">...</span>
          <Button variant="ghost" size="sm">Next</Button>
        </div>
      </div>
    </Card>
  </div>
);

const ChurnRiskTab = () => {
  const severityTone = (severity: string): BadgeTone =>
    severity === "Critical" ? "danger" : severity === "High" ? "warning" : "neutral";
  const severityBar = (severity: string): string =>
    severity === "Critical" ? "bg-[var(--st-danger)]" : severity === "High" ? "bg-[var(--st-warn)]" : "bg-[var(--st-text-tertiary)]";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-semibold text-[var(--st-text)] mb-2">Churn Risk Management</h2>
          <p className="text-[var(--st-text-secondary)] text-sm">Track and mitigate accounts at risk of cancellation or downgrade.</p>
        </div>
        <Button variant="danger" iconLeft={AlertTriangle}>
          Report Risk
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {["Investigating", "Action Required", "Monitoring"].map((statusColumn) => (
          <Card key={statusColumn} variant="outlined" padding="none" className="flex flex-col h-[600px] overflow-hidden">
            <div className="p-4 border-b border-[var(--st-border)] flex justify-between items-center bg-[var(--st-bg-secondary)]">
              <h3 className="font-semibold text-[var(--st-text)] text-sm">{statusColumn}</h3>
              <Badge tone="neutral">{CHURN_RISKS.filter((r) => r.status === statusColumn).length}</Badge>
            </div>
            <div className="p-3 flex-1 overflow-y-auto space-y-3">
              {CHURN_RISKS.filter((r) => r.status === statusColumn).map((risk) => (
                <Card key={risk.id} variant="outlined" padding="none" className="relative overflow-hidden group">
                  <div className={`absolute top-0 left-0 w-1 h-full ${severityBar(risk.severity)}`} aria-hidden="true" />
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2 pl-2">
                      <h4 className="font-medium text-[var(--st-text)] text-sm">{risk.account}</h4>
                      <Badge tone={severityTone(risk.severity)}>{risk.severity}</Badge>
                    </div>
                    <p className="text-xs text-[var(--st-text-secondary)] mb-4 pl-2 line-clamp-2">{risk.reason}</p>

                    <div className="flex items-center justify-between text-xs pt-3 border-t border-[var(--st-border)] pl-2">
                      <div className="flex items-center text-[var(--st-text-secondary)]">
                        <DollarSign className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                        ${(risk.mrr / 1000).toFixed(1)}k MRR
                      </div>
                      <div className="flex items-center text-[var(--st-danger)]">
                        <Clock className="w-3 h-3 mr-1" aria-hidden="true" />
                        {risk.daysAtRisk}d at risk
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-0 bg-[var(--st-bg)]/85 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                    <IconButton label="View risk details" icon={Eye} variant="primary" />
                    <IconButton label="Move status" icon={ArrowRight} variant="secondary" />
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const QBRTab = () => (
  <div className="space-y-6">
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-2/3 space-y-6">
        <Card variant="elevated" padding="lg">
          <CardHeader className="flex justify-between items-center">
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-[var(--st-accent)]" aria-hidden="true" />
              Upcoming QBRs
            </CardTitle>
            <Button variant="outline" size="sm">Schedule QBR</Button>
          </CardHeader>

          <CardBody>
            <div className="space-y-4">
              {QBR_SCHEDULE.map((qbr) => (
                <div key={qbr.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                  <div className="flex items-start gap-4 mb-4 sm:mb-0">
                    <div className="bg-[var(--st-accent-soft)] border border-[var(--st-border)] text-[var(--st-accent)] p-3 rounded-[var(--st-radius)] text-center min-w-[70px]">
                      <div className="text-xs uppercase font-bold">{new Date(qbr.date).toLocaleString("default", { month: "short" })}</div>
                      <div className="text-xl font-bold">{new Date(qbr.date).getDate()}</div>
                    </div>
                    <div>
                      <h4 className="font-medium text-[var(--st-text)] text-lg">{qbr.account}</h4>
                      <div className="flex items-center text-sm text-[var(--st-text-secondary)] mt-1 gap-4">
                        <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> {qbr.time}</span>
                        <span className="flex items-center"><UserCheck className="w-3.5 h-3.5 mr-1" aria-hidden="true" /> {qbr.owner}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end w-full sm:w-auto gap-2 sm:gap-3">
                    <Badge tone={qbr.status === "Completed" ? "success" : qbr.status === "Scheduled" ? "accent" : "warning"}>
                      {qbr.status}
                    </Badge>
                    <div className="flex gap-2 w-full justify-end">
                      <IconButton label="Edit QBR" icon={Settings} size="sm" />
                      <IconButton label="Generate deck" icon={FileText} size="sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="lg:w-1/3 space-y-6">
        <Card variant="elevated" padding="lg">
          <CardHeader>
            <CardTitle>QBR Readiness</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--st-text-secondary)]">Data Collection</span>
                  <span className="text-[var(--st-status-ok)]">100%</span>
                </div>
                <Progress value={100} tone="success" size="sm" aria-label="Data collection progress" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--st-text-secondary)]">Slide Deck Generation</span>
                  <span className="text-[var(--st-warn)]">65%</span>
                </div>
                <Progress value={65} tone="warning" size="sm" aria-label="Slide deck generation progress" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--st-text-secondary)]">Executive Summary</span>
                  <span className="text-[var(--st-text-tertiary)]">0%</span>
                </div>
                <Progress value={0} size="sm" aria-label="Executive summary progress" />
              </div>
            </div>

            <div className="mt-6 p-4 bg-[var(--st-accent-soft)] border border-[var(--st-border)] rounded-[var(--st-radius)]">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-[var(--st-accent)] shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h4 className="text-sm font-medium text-[var(--st-text)] mb-1">Automate Prep</h4>
                  <p className="text-xs text-[var(--st-text-secondary)] mb-3">Connect SabDesk to your CRM and Analytics to auto-generate QBR decks.</p>
                  <Button variant="primary" size="sm">Setup Integration</Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  </div>
);

const PlaybooksTab = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {PLAYBOOKS.map((playbook) => (
        <Card key={playbook.id} variant="elevated" padding="lg" className="flex flex-col h-full">
          <div className="flex items-start justify-between mb-4">
            <span className="p-3 rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] border border-[var(--st-border)] text-[var(--st-accent)]" aria-hidden="true">
              <BookOpen className="w-6 h-6" />
            </span>
            <Badge tone="neutral">{playbook.activeRuns} Active Runs</Badge>
          </div>

          <h3 className="text-lg font-semibold text-[var(--st-text)] mb-2">{playbook.name}</h3>
          <p className="text-sm text-[var(--st-text-secondary)] mb-6 flex-1">{playbook.description}</p>

          <div className="space-y-3">
            <div className="flex items-center text-xs text-[var(--st-text-secondary)] bg-[var(--st-bg-secondary)] p-2 rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <Activity className="w-4 h-4 mr-2 text-[var(--st-text-tertiary)]" aria-hidden="true" />
              <span className="text-[var(--st-text-tertiary)] mr-1">Trigger:</span> {playbook.triggers}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[var(--st-border)]">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-[var(--st-text-tertiary)] font-semibold mb-1">Success Rate</span>
                <span className="text-lg font-bold text-[var(--st-status-ok)]">{playbook.successRate}%</span>
              </div>

              <Button variant="outline" size="sm" iconLeft={PlayCircle}>
                Run
              </Button>
            </div>
          </div>
        </Card>
      ))}

      <Card variant="ghost" padding="lg" className="border-2 border-dashed border-[var(--st-border)] flex flex-col items-center justify-center min-h-[300px] text-center cursor-pointer">
        <span className="p-4 rounded-full bg-[var(--st-bg-secondary)] mb-4" aria-hidden="true">
          <Plus className="w-8 h-8 text-[var(--st-text-secondary)]" />
        </span>
        <h3 className="text-lg font-semibold text-[var(--st-text)] mb-2">Create New Playbook</h3>
        <p className="text-sm text-[var(--st-text-secondary)] max-w-[200px]">Define automated actions and workflows for your team.</p>
      </Card>
    </div>
  </div>
);

// --- MAIN PAGE COMPONENT ---

export default function CustomerSuccessDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart2 },
    { id: "health", label: "Account Health", icon: HeartPulse },
    { id: "risk", label: "Churn Risk", icon: ShieldAlert },
    { id: "qbr", label: "QBR Tracking", icon: Calendar },
    { id: "playbooks", label: "Playbooks", icon: BookOpen },
  ];

  return (
    <div className="ui20 dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] pb-20">
      {/* Top Navigation Bar / Header */}
      <header className="sticky top-0 z-50 bg-[var(--st-bg)]/80 backdrop-blur-xl border-b border-[var(--st-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-[var(--st-accent)] rounded-[var(--st-radius)] flex items-center justify-center" aria-hidden="true">
              <Users className="w-5 h-5 text-[var(--st-text-inverted)]" />
            </span>
            <span className="text-xl font-bold text-[var(--st-text)] tracking-tight">Customer Success</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="relative inline-flex">
              <IconButton label="Notifications" icon={Bell} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--st-danger)] rounded-full border border-[var(--st-bg)]" aria-hidden="true" />
            </span>
            <span className="h-6 w-px bg-[var(--st-border)]" aria-hidden="true" />
            <Avatar shape="round" size="md">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="Sarah Jenkins avatar" />
              <AvatarFallback>SJ</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Page Header Area */}
        <PageHeader bordered={false} className="mb-8">
          <PageHeaderHeading>
            <PageTitle>Success Hub</PageTitle>
            <PageDescription>Monitor health, manage risks, and drive adoption across your portfolio.</PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="outline" iconLeft={Download}>
              Export Report
            </Button>
            <Button variant="primary" iconLeft={Plus}>
              New Action
            </Button>
          </PageActions>
        </PageHeader>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                <span className="flex items-center gap-2">
                  <tab.icon className="w-4 h-4" aria-hidden="true" />
                  {tab.label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="relative min-h-[500px]">
            <TabsContent value="overview"><OverviewTab /></TabsContent>
            <TabsContent value="health"><AccountHealthTab /></TabsContent>
            <TabsContent value="risk"><ChurnRiskTab /></TabsContent>
            <TabsContent value="qbr"><QBRTab /></TabsContent>
            <TabsContent value="playbooks"><PlaybooksTab /></TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
