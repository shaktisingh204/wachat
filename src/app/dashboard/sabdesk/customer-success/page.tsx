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
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  BarChart2,
  PieChart,
  TrendingUp,
  Mail,
  Phone,
  FileText,
  Zap,
  ShieldAlert,
  Target,
  RefreshCw,
  UserCheck,
  Building,
  HeartPulse,
  DollarSign,
  TrendingDown,
  MessageSquare,
  Settings,
  Bell,
  Star,
  Award,
  Layers,
  MapPin,
  PlayCircle,
  Download,
  UploadCloud,
  Globe
} from "lucide-react";

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
  { id: 302, name: "Low Adoption Recovery", description: "Engagement sequence for accounts with <30% MAU.", triggers: "Health Score < 50", successRate: 68, activeRuns: 5 },
  { id: 303, name: "Executive Sponsor Transition", description: "Steps to secure new championship when sponsor leaves.", triggers: "Contact Role Change", successRate: 45, activeRuns: 2 },
  { id: 304, name: "QBR Preparation", description: "Automated data collection and presentation template generation.", triggers: "90 days since last QBR", successRate: 100, activeRuns: 8 },
  { id: 305, name: "Renewal Risk Mitigation", description: "Intensive 60-day sequence for at-risk renewals.", triggers: "Renewal < 90 days & Risk High", successRate: 72, activeRuns: 3 },
];

// --- REUSABLE COMPONENTS ---

const MetricCard = ({ title, value, change, trend, icon: Icon, colorClass }: any) => (
  <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
    <div className={`absolute -right-12 -top-12 w-32 h-32 bg-gradient-to-br ${colorClass} opacity-20 rounded-full blur-3xl transition-transform group-hover:scale-150`} />
    <div className="flex justify-between items-start mb-4 relative z-10">
      <div className={`p-3 rounded-xl bg-white/5 border border-white/10 text-gray-300`}>
        <Icon className="w-5 h-5" />
      </div>
      {change && (
        <span className={`flex items-center text-xs font-medium px-2 py-1 rounded-full border ${trend === 'up' ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-rose-400 bg-rose-400/10 border-rose-400/20'}`}>
          {trend === 'up' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
          {change}
        </span>
      )}
    </div>
    <div className="relative z-10">
      <h3 className="text-gray-400 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-semibold text-white tracking-tight">{value}</p>
    </div>
  </div>
);

const ProgressBar = ({ value, color = "bg-indigo-500" }: { value: number, color?: string }) => (
  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
    <div className={`${color} h-full rounded-full transition-all duration-1000 ease-in-out`} style={{ width: `${value}%` }}></div>
  </div>
);

const Badge = ({ children, color = "gray" }: { children: React.ReactNode, color?: string }) => {
  const colorStyles: Record<string, string> = {
    gray: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${colorStyles[color] || colorStyles.gray}`}>
      {children}
    </span>
  );
};

const HealthScoreIndicator = ({ score }: { score: number }) => {
  let color = "bg-emerald-500";
  if (score < 40) color = "bg-rose-500";
  else if (score < 70) color = "bg-amber-500";
  
  return (
    <div className="flex items-center space-x-3">
      <div className="flex-1">
        <ProgressBar value={score} color={color} />
      </div>
      <span className={`text-sm font-semibold w-8 text-right ${
        score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-rose-400"
      }`}>{score}</span>
    </div>
  );
}

// --- SUBVIEWS ---

const OverviewTab = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard title="Total ARR Managed" value="$151,200" change="+12.5%" trend="up" icon={DollarSign} colorClass="from-emerald-500 to-teal-500" />
      <MetricCard title="Avg. Health Score" value="68.4" change="-2.1%" trend="down" icon={HeartPulse} colorClass="from-blue-500 to-indigo-500" />
      <MetricCard title="Accounts at Risk" value="4" change="+1" trend="down" icon={ShieldAlert} colorClass="from-rose-500 to-orange-500" />
      <MetricCard title="Upcoming QBRs" value="3" change="Next 30 days" trend="up" icon={Calendar} colorClass="from-amber-500 to-yellow-500" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-[#111111] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Health Score Distribution</h3>
          <button className="text-sm text-gray-400 hover:text-white flex items-center transition-colors">
            View Details <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
        <div className="h-64 flex items-end justify-between space-x-2">
          {/* Mock Chart Bars */}
          {[12, 5, 8, 15, 22, 35, 45, 60, 85, 40].map((val, i) => (
            <div key={i} className="w-full flex flex-col items-center group relative">
              <div 
                className={`w-full rounded-t-sm transition-all duration-500 ${
                  i < 3 ? 'bg-rose-500/80 hover:bg-rose-400' : 
                  i < 6 ? 'bg-amber-500/80 hover:bg-amber-400' : 
                  'bg-emerald-500/80 hover:bg-emerald-400'
                }`}
                style={ height: `${val}%` }
              ></div>
              <span className="text-[10px] text-gray-500 mt-2 block">{i * 10}</span>
              {/* Tooltip */}
              <div className="opacity-0 group-hover:opacity-100 absolute -top-10 bg-black border border-white/20 text-white text-xs py-1 px-2 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                {val} accounts
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#111111] border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
          <button className="p-1 hover:bg-white/10 rounded-md transition-colors"><MoreVertical className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
          {[
            { title: "QBR Completed", desc: "Stark Industries", time: "2 hours ago", icon: CheckCircle, color: "text-emerald-400 bg-emerald-400/10" },
            { title: "Risk Alert Triggered", desc: "Cyberdyne Systems", time: "5 hours ago", icon: AlertTriangle, color: "text-rose-400 bg-rose-400/10" },
            { title: "Playbook Activated", desc: "New Enterprise Onboarding", time: "1 day ago", icon: PlayCircle, color: "text-indigo-400 bg-indigo-400/10" },
            { title: "NPS Survey Received", desc: "Acme Corp (Score: 9)", time: "2 days ago", icon: Star, color: "text-amber-400 bg-amber-400/10" }
          ].map((item, i) => (
            <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border border-white/10 ${item.color} shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-xl z-10`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-white">{item.title}</h4>
                  <span className="text-xs text-gray-500">{item.time}</span>
                </div>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const AccountHealthTab = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex flex-col sm:flex-row justify-between gap-4">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input 
          type="text" 
          placeholder="Search accounts..." 
          className="w-full bg-[#111111] border border-white/10 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
        />
      </div>
      <div className="flex space-x-3">
        <button className="flex items-center space-x-2 bg-[#111111] border border-white/10 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors">
          <Filter className="w-4 h-4" />
          <span>Filters</span>
        </button>
        <button className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4" />
          <span>Add Account</span>
        </button>
      </div>
    </div>

    <div className="bg-[#111111] border border-white/10 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Account</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Plan & MRR</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider w-1/4">Health Score</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Last Contact</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider">CSM</th>
              <th className="p-4 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {ACCOUNTS_DATA.map((account) => (
              <tr key={account.id} className="hover:bg-white/5 transition-colors group">
                <td className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                      {account.logo}
                    </div>
                    <div>
                      <div className="font-medium text-white flex items-center">
                        {account.name}
                        {account.trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400 ml-2" />}
                        {account.trend === 'down' && <TrendingDown className="w-3 h-3 text-rose-400 ml-2" />}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">ID: ACC-{account.id.toString().padStart(4, '0')}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-sm font-medium text-white mb-1">${account.mrr.toLocaleString()}/mo</div>
                  <Badge color={account.plan === 'Enterprise' ? 'indigo' : account.plan === 'Pro' ? 'blue' : 'gray'}>
                    {account.plan}
                  </Badge>
                </td>
                <td className="p-4">
                  <HealthScoreIndicator score={account.healthScore} />
                </td>
                <td className="p-4 text-sm text-gray-400">
                  <div className="flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                    {account.lastContact}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-300">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold border border-white/10">
                      {account.csm.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span>{account.csm}</span>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-white/10 flex items-center justify-between text-sm text-gray-400">
        <span>Showing 1 to 10 of 42 accounts</span>
        <div className="flex space-x-1">
          <button className="px-3 py-1 rounded-md hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors">Previous</button>
          <button className="px-3 py-1 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">1</button>
          <button className="px-3 py-1 rounded-md hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors">2</button>
          <button className="px-3 py-1 rounded-md hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors">3</button>
          <span className="px-2 py-1">...</span>
          <button className="px-3 py-1 rounded-md hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors">Next</button>
        </div>
      </div>
    </div>
  </div>
);

const ChurnRiskTab = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex justify-between items-end mb-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-2">Churn Risk Management</h2>
        <p className="text-gray-400 text-sm">Track and mitigate accounts at risk of cancellation or downgrade.</p>
      </div>
      <button className="flex items-center space-x-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
        <AlertTriangle className="w-4 h-4" />
        <span>Report Risk</span>
      </button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Kanban Board Mockup */}
      {['Investigating', 'Action Required', 'Monitoring'].map((statusColumn) => (
        <div key={statusColumn} className="flex flex-col bg-[#0a0a0a] border border-white/5 rounded-xl h-[600px] overflow-hidden">
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
            <h3 className="font-semibold text-white text-sm">{statusColumn}</h3>
            <span className="bg-white/10 text-gray-300 text-xs px-2 py-0.5 rounded-full font-medium">
              {CHURN_RISKS.filter(r => r.status === statusColumn).length}
            </span>
          </div>
          <div className="p-3 flex-1 overflow-y-auto space-y-3">
            {CHURN_RISKS.filter(r => r.status === statusColumn).map((risk) => (
              <div key={risk.id} className="bg-[#111111] border border-white/10 rounded-lg p-4 cursor-grab hover:border-white/30 transition-colors shadow-sm relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 h-full ${
                  risk.severity === 'Critical' ? 'bg-rose-500' : 
                  risk.severity === 'High' ? 'bg-orange-500' : 'bg-amber-500'
                }`} />
                <div className="flex justify-between items-start mb-2 pl-2">
                  <h4 className="font-medium text-white text-sm">{risk.account}</h4>
                  <Badge color={
                    risk.severity === 'Critical' ? 'rose' : 
                    risk.severity === 'High' ? 'amber' : 'gray'
                  }>
                    {risk.severity}
                  </Badge>
                </div>
                <p className="text-xs text-gray-400 mb-4 pl-2 line-clamp-2">{risk.reason}</p>
                
                <div className="flex items-center justify-between text-xs pt-3 border-t border-white/10 pl-2">
                  <div className="flex items-center text-gray-400">
                    <DollarSign className="w-3.5 h-3.5 mr-1" />
                    ${(risk.mrr / 1000).toFixed(1)}k MRR
                  </div>
                  <div className="flex items-center text-rose-400 bg-rose-400/10 px-2 py-1 rounded-md">
                    <Clock className="w-3 h-3 mr-1" />
                    {risk.daysAtRisk}d at risk
                  </div>
                </div>
                
                {/* Action overlay on hover */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                  <button className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors" title="View Details">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors" title="Move Status">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Minimal icons needed for local scope
const Eye = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
const ArrowRight = ({ className }: { className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;


const QBRTab = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-2/3 space-y-6">
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-indigo-400" />
              Upcoming QBRs
            </h3>
            <button className="text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-1.5 rounded-lg transition-colors">
              Schedule QBR
            </button>
          </div>
          
          <div className="space-y-4">
            {QBR_SCHEDULE.map((qbr) => (
              <div key={qbr.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors group">
                <div className="flex items-start space-x-4 mb-4 sm:mb-0">
                  <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 p-3 rounded-xl text-center min-w-[70px]">
                    <div className="text-xs uppercase font-bold">{new Date(qbr.date).toLocaleString('default', { month: 'short' })}</div>
                    <div className="text-xl font-bold">{new Date(qbr.date).getDate()}</div>
                  </div>
                  <div>
                    <h4 className="font-medium text-white text-lg">{qbr.account}</h4>
                    <div className="flex items-center text-sm text-gray-400 mt-1 space-x-4">
                      <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {qbr.time}</span>
                      <span className="flex items-center"><UserCheck className="w-3.5 h-3.5 mr-1" /> {qbr.owner}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:items-end w-full sm:w-auto space-y-2 sm:space-y-3">
                  <Badge color={
                    qbr.status === 'Completed' ? 'emerald' : 
                    qbr.status === 'Scheduled' ? 'indigo' : 'amber'
                  }>
                    {qbr.status}
                  </Badge>
                  <div className="flex space-x-2 w-full justify-end">
                    <button className="p-2 text-gray-400 hover:text-white bg-black/20 hover:bg-black/40 rounded-lg transition-colors" title="Edit">
                      <Settings className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-indigo-400 bg-black/20 hover:bg-black/40 rounded-lg transition-colors" title="Generate Deck">
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="lg:w-1/3 space-y-6">
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">QBR Readiness</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Data Collection</span>
                <span className="text-emerald-400">100%</span>
              </div>
              <ProgressBar value={100} color="bg-emerald-500" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Slide Deck Generation</span>
                <span className="text-amber-400">65%</span>
              </div>
              <ProgressBar value={65} color="bg-amber-500" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Executive Summary</span>
                <span className="text-gray-500">0%</span>
              </div>
              <ProgressBar value={0} color="bg-gray-600" />
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <div className="flex items-start space-x-3">
              <Zap className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-white mb-1">Automate Prep</h4>
                <p className="text-xs text-gray-400 mb-3">Connect SabDesk to your CRM and Analytics to auto-generate QBR decks.</p>
                <button className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                  Setup Integration
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const PlaybooksTab = () => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {PLAYBOOKS.map((playbook) => (
        <div key={playbook.id} className="bg-[#111111] border border-white/10 rounded-2xl p-6 hover:border-indigo-500/30 transition-all group flex flex-col h-full relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full group-hover:bg-indigo-500/10 transition-colors" />
          
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-indigo-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <Badge color="gray">{playbook.activeRuns} Active Runs</Badge>
          </div>
          
          <h3 className="text-lg font-semibold text-white mb-2 relative z-10">{playbook.name}</h3>
          <p className="text-sm text-gray-400 mb-6 flex-1 relative z-10">{playbook.description}</p>
          
          <div className="space-y-3 relative z-10">
            <div className="flex items-center text-xs text-gray-300 bg-white/5 p-2 rounded-lg border border-white/5">
              <Activity className="w-4 h-4 mr-2 text-gray-500" />
              <span className="text-gray-500 mr-1">Trigger:</span> {playbook.triggers}
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Success Rate</span>
                <span className="text-lg font-bold text-emerald-400">{playbook.successRate}%</span>
              </div>
              
              <button className="flex items-center space-x-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-1.5 rounded-lg text-sm transition-colors">
                <PlayCircle className="w-4 h-4" />
                <span>Run</span>
              </button>
            </div>
          </div>
        </div>
      ))}
      
      {/* Add New Playbook Card */}
      <div className="bg-transparent border-2 border-dashed border-white/10 rounded-2xl p-6 hover:border-white/30 hover:bg-white/5 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[300px] group text-center">
        <div className="p-4 rounded-full bg-white/5 mb-4 group-hover:scale-110 transition-transform">
          <Plus className="w-8 h-8 text-gray-400 group-hover:text-white" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Create New Playbook</h3>
        <p className="text-sm text-gray-400 max-w-[200px]">Define automated actions and workflows for your team.</p>
      </div>
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
    <div className="min-h-screen bg-black text-gray-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 pb-20">
      {/* Top Navigation Bar / Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 tracking-tight">
              Customer Success
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-black"></span>
            </button>
            <div className="h-6 w-px bg-white/10"></div>
            <div className="flex items-center space-x-2">
              <img 
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" 
                alt="User avatar" 
                className="w-8 h-8 rounded-full bg-white/10 border border-white/20"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Page Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight mb-1">Success Hub</h2>
            <p className="text-gray-400 text-sm">Monitor health, manage risks, and drive adoption across your portfolio.</p>
          </div>
          <div className="flex space-x-3">
            <button className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Download className="w-4 h-4" />
              <span>Export Report</span>
            </button>
            <button className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
              <Plus className="w-4 h-4" />
              <span>New Action</span>
            </button>
          </div>
        </div>

        {/* Custom Tab Navigation */}
        <div className="mb-8 overflow-x-auto scrollbar-hide">
          <div className="flex space-x-1 border-b border-white/10 min-w-max pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-5 py-3 text-sm font-medium transition-all relative ${
                  activeTab === tab.id
                    ? "text-indigo-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-t-lg"
                }`}
              >
                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'animate-pulse' : ''}`} />
                <span>{tab.label}</span>
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-t-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Render */}
        <div className="relative min-h-[500px]">
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "health" && <AccountHealthTab />}
          {activeTab === "risk" && <ChurnRiskTab />}
          {activeTab === "qbr" && <QBRTab />}
          {activeTab === "playbooks" && <PlaybooksTab />}
        </div>
      </main>
    </div>
  );
}
