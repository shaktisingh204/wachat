"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar, Users, Truck, Wrench, Settings, Search, Bell, Menu, Plus, Filter,
  MoreVertical, CheckCircle2, Clock, AlertTriangle, MapPin, MessageSquare,
  List, Grid, CalendarDays, BarChart3, Activity,
  Briefcase, Zap, Battery, Signal,
  FileText, Edit2,
  Minus, Crosshair, Map as MapIcon, Layers, ScanLine, Download,
  Smartphone, Star,
} from "lucide-react";
import {
  Button,
  IconButton,
  Card,
  Badge,
  type BadgeTone,
  Dot,
  StatCard,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Checkbox,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Modal,
  Progress,
  Pagination,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  EmptyState,
  useToast,
} from "@/components/sabcrm/20ui";

// --- MOCK DATA ---

const generateTechnicians = () => Array.from({ length: 45 }, (_, i) => ({
  id: `TECH-${1000 + i}`,
  name: `Technician ${i + 1}`,
  status: ["Active", "On Break", "Off Duty", "In Transit", "Emergency"][Math.floor(Math.random() * 5)],
  battery: Math.floor(Math.random() * 100),
  signal: Math.floor(Math.random() * 4) + 1,
  currentJob: Math.random() > 0.3 ? `JOB-${2000 + i}` : null,
  location: { x: Math.random() * 100, y: Math.random() * 100 },
  avatar: `https://i.pravatar.cc/150?u=tech${i}`,
  skills: ["HVAC", "Plumbing", "Electrical", "Carpentry", "Network", "Security"].sort(() => 0.5 - Math.random()).slice(0, 3),
  rating: (Math.random() * 1 + 4).toFixed(1),
  jobsCompleted: Math.floor(Math.random() * 1500),
  vehicle: `Van ${Math.floor(Math.random() * 50)}`,
  lastSeen: `${Math.floor(Math.random() * 60)} mins ago`,
}));

const generateJobs = () => Array.from({ length: 300 }, (_, i) => {
  const statuses = ["Unassigned", "Dispatched", "In Progress", "Completed", "On Hold", "Cancelled"];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  return {
    id: `JOB-${2000 + i}`,
    title: `Service Request ${i + 1}`,
    customer: `Enterprise Corp ${i + 1}`,
    address: `${Math.floor(Math.random() * 9999)} Commerce Blvd, City`,
    priority: ["Low", "Medium", "High", "Urgent", "Critical"][Math.floor(Math.random() * 5)],
    status: status,
    date: new Date(Date.now() - Math.random() * 10000000000).toISOString().split('T')[0],
    time: `${Math.floor(Math.random() * 12 + 1)}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')} ${Math.random() > 0.5 ? 'AM' : 'PM'}`,
    type: ["Repair", "Installation", "Maintenance", "Inspection", "Audit", "Emergency Call"][Math.floor(Math.random() * 6)],
    technicianId: status !== "Unassigned" && status !== "Cancelled" ? `TECH-${1000 + Math.floor(Math.random() * 45)}` : null,
    amount: `$${(Math.random() * 5000).toFixed(2)}`,
    progress: status === "In Progress" ? Math.floor(Math.random() * 100) : (status === "Completed" ? 100 : 0),
    location: { x: Math.random() * 100, y: Math.random() * 100 },
  };
});

const STATS = [
  { label: "Total Active Jobs", value: "1,284", change: "+12.5%", trend: "up" as const, icon: Briefcase, accent: "#3b7bff" },
  { label: "Technicians Online", value: "32/45", change: "+4.1%", trend: "up" as const, icon: Users, accent: "#6cc06f" },
  { label: "Critical Alerts", value: "12", change: "-2.3%", trend: "down" as const, icon: AlertTriangle, accent: "#f3777a" },
  { label: "Avg Response Time", value: "24m", change: "-1.5m", trend: "down" as const, icon: Clock, accent: "#e0974a" },
  { label: "Revenue (Today)", value: "$45.2k", change: "+18.2%", trend: "up" as const, icon: Activity, accent: "#a78bfa" },
  { label: "Completed Jobs", value: "142", change: "+5.4%", trend: "up" as const, icon: CheckCircle2, accent: "#22d3ee" },
];

const ALERTS = Array.from({ length: 15 }, (_, i) => ({
  id: `ALT-${i}`,
  type: ["warning", "error", "info"][Math.floor(Math.random() * 3)],
  message: ["Vehicle needs maintenance", "Technician idle for 30m", "Job SLA approaching breach", "Customer updated request", "Traffic delay reported"][Math.floor(Math.random() * 5)],
  time: `${Math.floor(Math.random() * 60)}m ago`,
  jobId: `JOB-${2000 + Math.floor(Math.random() * 100)}`,
}));

// --- UTILS ---

const PRIORITY_TONE: Record<string, BadgeTone> = {
  Critical: "danger",
  Urgent: "danger",
  High: "warning",
  Medium: "info",
  Low: "neutral",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  Completed: "success",
  "In Progress": "info",
  Dispatched: "accent",
  "On Hold": "warning",
  Cancelled: "danger",
  Unassigned: "neutral",
};

const getPriorityTone = (priority: string): BadgeTone => PRIORITY_TONE[priority] ?? "neutral";
const getStatusTone = (status: string): BadgeTone => STATUS_TONE[status] ?? "neutral";

// --- MAIN PAGE COMPONENT ---

export default function FieldServiceDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("live-map");
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    // Simulate loading data
    setTechnicians(generateTechnicians());
    setJobs(generateJobs());
  }, []);

  const TABS = [
    { id: "live-map", label: "Live Command Center", icon: MapIcon },
    { id: "dispatch", label: "Dispatch Board", icon: Grid },
    { id: "queue", label: "Job Queue", icon: List },
    { id: "technicians", label: "Fleet & Techs", icon: Truck },
    { id: "analytics", label: "Insights", icon: BarChart3 },
    { id: "inventory", label: "Inventory", icon: Layers },
    { id: "settings", label: "Config", icon: Settings },
  ];

  return (
    <div className="ui20 dark flex h-screen w-full bg-[var(--st-bg)] text-[var(--st-text)] overflow-hidden">

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className={`flex flex-col transition-all duration-300 border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)] ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--st-border)]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-[var(--st-radius)] bg-[var(--st-accent)] flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-[var(--st-text-inverted)]" aria-hidden="true" />
            </div>
            {isSidebarOpen && <span className="font-bold text-lg tracking-tight text-[var(--st-text)] whitespace-nowrap">SabDesk FSM</span>}
          </div>
          <IconButton
            label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            icon={Menu}
            size="sm"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
          />
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {TABS.map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                variant={isActive ? "secondary" : "ghost"}
                block
                iconLeft={TabIcon}
                onClick={() => setActiveTab(tab.id)}
                className={`!justify-start ${isActive ? "text-[var(--st-accent)]" : "text-[var(--st-text-secondary)]"}`}
                aria-current={isActive ? "page" : undefined}
              >
                {isSidebarOpen ? (
                  <span className="flex items-center justify-between w-full">
                    <span className="whitespace-nowrap">{tab.label}</span>
                    {isActive && <Dot tone="accent" pulse aria-hidden="true" />}
                  </span>
                ) : null}
              </Button>
            );
          })}
        </div>

        {/* Mini stats in sidebar */}
        {isSidebarOpen && (
          <div className="p-4 border-t border-[var(--st-border)] bg-[var(--st-bg-muted)]">
            <div className="text-xs font-semibold text-[var(--st-text-secondary)] mb-3 uppercase tracking-wider">System Status</div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-[var(--st-text-secondary)]">API Health</span>
                  <span className="text-[var(--st-status-ok)]">99.9%</span>
                </div>
                <Progress value={99.9} tone="success" size="sm" aria-label="API health" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-[var(--st-text-secondary)]">Fleet Active</span>
                  <span className="text-[var(--st-accent)]">71%</span>
                </div>
                <Progress value={71} tone="accent" size="sm" aria-label="Fleet active" />
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative z-0">

        {/* TOP HEADER */}
        <header className="h-16 border-b border-[var(--st-border)] bg-[var(--st-bg)] flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-96 max-w-full">
              <Field label="" className="!gap-0">
                <Input
                  type="text"
                  iconLeft={Search}
                  placeholder="Search jobs, technicians, customers, or serial numbers..."
                  aria-label="Search field service"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:flex items-center gap-2 mr-2 px-3 py-1.5 rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] border border-[var(--st-border)]">
              <Dot tone="success" pulse aria-hidden="true" />
              <span className="text-xs font-medium text-[var(--st-text-secondary)]">Live Sync Active</span>
            </span>

            <IconButton label="Notifications" icon={Bell} />
            <IconButton label="Settings" icon={Settings} />

            <Button variant="primary" iconLeft={Plus} onClick={() => setIsFormOpen(true)}>
              New Job
            </Button>

            <Avatar shape="round" size="md" className="ml-2">
              <AvatarImage src="https://i.pravatar.cc/150?u=admin" alt="Admin" />
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* SUBHEADER STATS (Visible on some tabs) */}
        {["live-map", "dispatch", "analytics"].includes(activeTab) && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 border-b border-[var(--st-border)] bg-[var(--st-bg)] z-10">
            {STATS.map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
                accent={stat.accent}
                delta={{ value: stat.change, tone: stat.trend }}
              />
            ))}
          </div>
        )}

        {/* DYNAMIC TAB CONTENT */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === "live-map" && <LiveMapTab technicians={technicians} jobs={jobs} />}
          {activeTab === "dispatch" && <DispatchBoardTab jobs={jobs} />}
          {activeTab === "queue" && <JobQueueTab jobs={jobs} />}
          {activeTab === "technicians" && <TechniciansTab technicians={technicians} />}
          {!["live-map", "dispatch", "queue", "technicians"].includes(activeTab) && (
            <div className="flex-1 h-full flex items-center justify-center p-8">
              <EmptyState
                icon={Layers}
                title={`${TABS.find(t => t.id === activeTab)?.label} Module`}
                description="This module is part of the extensive SabDesk Field Service Management suite. Features are continuously being rolled out."
              />
            </div>
          )}
        </div>
      </main>

      {/* CREATE JOB MODAL */}
      <Modal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        size="lg"
        title="Create Comprehensive Work Order"
        description="Fill out the multi-stage form to dispatch a new job."
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                toast.success("Work order saved as draft");
                setIsFormOpen(false);
              }}
            >
              Save as Draft
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                toast.success("Job dispatched");
                setIsFormOpen(false);
              }}
            >
              Dispatch Job
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Form Area */}
          <div className="md:col-span-2 space-y-8">
            {/* Section 1 */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-[var(--st-text)] border-b border-[var(--st-border)] pb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" /> General Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Job Title">
                  <Input type="text" placeholder="e.g. AC Maintenance" />
                </Field>
                <Field label="Job Type">
                  <Select defaultValue="Repair">
                    <SelectTrigger aria-label="Job Type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Repair">Repair</SelectItem>
                      <SelectItem value="Installation">Installation</SelectItem>
                      <SelectItem value="Inspection">Inspection</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="col-span-2">
                  <Field label="Detailed Description">
                    <Textarea rows={3} placeholder="Describe the issue..." />
                  </Field>
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-[var(--st-text)] border-b border-[var(--st-border)] pb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" /> Customer & Location
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Select Customer">
                  <Select defaultValue="Enterprise Corp">
                    <SelectTrigger aria-label="Select Customer">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Enterprise Corp">Enterprise Corp</SelectItem>
                      <SelectItem value="Global Industries">Global Industries</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Contact Person">
                  <Input type="text" placeholder="John Doe" />
                </Field>
                <div className="col-span-2">
                  <Field label="Service Address">
                    <Input type="text" iconLeft={MapPin} placeholder="123 Commerce Blvd..." />
                  </Field>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-4">
              <h3 className="text-base font-semibold text-[var(--st-text)] border-b border-[var(--st-border)] pb-2 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[var(--st-text-secondary)]" aria-hidden="true" /> Equipment & Assets
              </h3>
              <Card variant="outlined" padding="lg" className="flex flex-col items-center justify-center text-center border-dashed">
                <ScanLine className="w-8 h-8 text-[var(--st-text-secondary)] mb-2" aria-hidden="true" />
                <p className="text-sm font-medium text-[var(--st-text)]">Scan or select equipment</p>
                <p className="text-xs text-[var(--st-text-secondary)] mb-4">Link specific customer assets to this work order</p>
                <Button variant="secondary" size="sm">Add Asset</Button>
              </Card>
            </section>
          </div>

          {/* Sidebar Form Area */}
          <div className="space-y-6 md:border-l md:border-[var(--st-border)] md:pl-8">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-[var(--st-text)] uppercase tracking-wider">Scheduling</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-[var(--st-text-secondary)]">Priority</span>
                  <div className="flex flex-wrap gap-2">
                    {["Low", "Medium", "High", "Critical"].map(p => (
                      <Button key={p} variant="outline" size="sm">{p}</Button>
                    ))}
                  </div>
                </div>
                <Field label="Scheduled Date">
                  <Input type="date" iconLeft={Calendar} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Start Time">
                    <Input type="time" />
                  </Field>
                  <Field label="Est. Duration">
                    <Input type="text" placeholder="2h 30m" />
                  </Field>
                </div>
              </div>
            </section>

            <section className="space-y-4 pt-4 border-t border-[var(--st-border)]">
              <h3 className="text-sm font-semibold text-[var(--st-text)] uppercase tracking-wider">Assignment</h3>
              <Card variant="outlined" padding="md" className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[var(--st-radius-pill)] bg-[var(--st-bg-muted)] flex items-center justify-center border border-dashed border-[var(--st-border-strong)]">
                    <Users className="w-5 h-5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--st-text)]">Unassigned</p>
                    <p className="text-xs text-[var(--st-text-secondary)]">Auto-assign based on skills?</p>
                  </div>
                </div>
                <Button variant="outline" block size="sm" onClick={() => toast.info("Searching for the best match...")}>
                  Find Best Match
                </Button>
              </Card>
            </section>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// --- SUB-COMPONENTS FOR TABS ---

function LiveMapTab({ technicians, jobs }: { technicians: any[]; jobs: any[] }) {
  return (
    <div className="h-full w-full flex relative bg-[var(--st-bg-secondary)]">
      {/* Background Map Grid Simulation */}
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(var(--st-accent) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 z-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(var(--st-border) 1px, transparent 1px), linear-gradient(90deg, var(--st-border) 1px, transparent 1px)', backgroundSize: '100px 100px' }}
        aria-hidden="true"
      />

      {/* Map Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Render some mock map elements */}
        {technicians.slice(0, 20).map((tech) => (
          <div
            key={tech.id}
            className="absolute z-20 group cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${tech.location.x}%`, top: `${tech.location.y}%` }}
          >
            <div className="relative">
              <div className={`w-8 h-8 rounded-[var(--st-radius-pill)] border-2 flex items-center justify-center ${tech.status === 'Active' ? 'border-[var(--st-status-ok)] bg-[var(--st-bg-muted)] text-[var(--st-status-ok)]' : 'border-[var(--st-border-strong)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]'}`}>
                <Truck className="w-4 h-4" aria-hidden="true" />
              </div>
              {/* Tooltip */}
              <Card variant="elevated" padding="sm" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                <div className="flex items-center gap-2 mb-1">
                  <Avatar shape="round" size="xs">
                    <AvatarImage src={tech.avatar} alt="" />
                    <AvatarFallback>{tech.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-[var(--st-text)] truncate">{tech.name}</span>
                </div>
                <div className="text-xs text-[var(--st-text-secondary)] flex justify-between">
                  <span>{tech.status}</span>
                  <span className="flex items-center gap-1"><Battery className="w-3 h-3" aria-hidden="true" />{tech.battery}%</span>
                </div>
              </Card>
            </div>
          </div>
        ))}

        {jobs.filter(j => j.status === 'Unassigned' || j.status === 'In Progress').slice(0, 15).map((job) => (
          <div
            key={job.id}
            className="absolute z-10 group cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${job.location.x}%`, top: `${job.location.y}%` }}
          >
            <div className={`p-1.5 rounded-[var(--st-radius)] border ${job.status === 'In Progress' ? 'bg-[var(--st-bg-muted)] border-[var(--st-accent)] text-[var(--st-accent)]' : 'bg-[var(--st-bg-muted)] border-[var(--st-warn)] text-[var(--st-warn)]'}`}>
              <Briefcase className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
        ))}

        {/* Floating Map Controls */}
        <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-30">
          <IconButton label="Zoom in" icon={Plus} variant="secondary" />
          <IconButton label="Zoom out" icon={Minus} variant="secondary" />
          <IconButton label="Recenter" icon={Crosshair} variant="secondary" />
        </div>

        {/* Floating Legend */}
        <Card variant="elevated" padding="md" className="absolute bottom-6 left-6 z-30 flex gap-6">
          <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]"><Dot tone="success" aria-hidden="true" /> Active Tech</div>
          <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]"><Dot tone="warning" aria-hidden="true" /> Pending Job</div>
          <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]"><Dot tone="accent" aria-hidden="true" /> Active Job</div>
        </Card>
      </div>

      {/* Right Sidebar: Live Feed & Alerts */}
      <div className="w-80 h-full border-l border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex flex-col z-20">
        <div className="p-4 border-b border-[var(--st-border)] flex justify-between items-center">
          <h3 className="font-semibold text-[var(--st-text)] flex items-center gap-2"><Activity className="w-4 h-4 text-[var(--st-accent)]" aria-hidden="true" /> Live Operations</h3>
          <Badge tone="danger" dot>Live</Badge>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-3">Critical Alerts</h4>
            <div className="space-y-2">
              {ALERTS.slice(0, 4).map(alert => (
                <Card key={alert.id} variant="outlined" padding="sm" className="flex gap-3">
                  <AlertTriangle className="w-4 h-4 text-[var(--st-danger)] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-[var(--st-text)]">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[var(--st-text-secondary)]">
                      <span>{alert.time}</span>
                      <span aria-hidden="true">-</span>
                      <span>{alert.jobId}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-3">Recent Activity</h4>
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="relative pl-6">
                  <span className="absolute left-1 top-1.5"><Dot tone="accent" aria-hidden="true" /></span>
                  <p className="text-sm text-[var(--st-text)]">Job <span className="text-[var(--st-accent)]">JOB-{3000 + i}</span> assigned to Technician {i + 1}</p>
                  <p className="text-xs text-[var(--st-text-secondary)]">{i * 12} mins ago</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DispatchBoardTab({ jobs }: { jobs: any[] }) {
  const { toast } = useToast();
  const columns: { id: string; title: string; tone: BadgeTone }[] = [
    { id: 'Unassigned', title: 'Unassigned Queue', tone: 'neutral' },
    { id: 'Dispatched', title: 'Dispatched', tone: 'accent' },
    { id: 'In Progress', title: 'In Progress', tone: 'info' },
    { id: 'On Hold', title: 'On Hold', tone: 'warning' },
    { id: 'Completed', title: 'Completed', tone: 'success' },
  ];

  return (
    <div className="h-full flex flex-col bg-[var(--st-bg-secondary)]">
      <div className="p-4 border-b border-[var(--st-border)] flex justify-between items-center bg-[var(--st-bg)]">
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" iconLeft={Filter}>Filter</Button>
          <Button variant="secondary" size="sm" iconLeft={CalendarDays}>Today</Button>
        </div>
        <div className="flex items-center gap-4 text-sm text-[var(--st-text-secondary)]">
          <span>Total Jobs: <strong className="text-[var(--st-text)]">{jobs.length}</strong></span>
          <span className="w-px h-4 bg-[var(--st-border)]" aria-hidden="true" />
          <span>Unassigned: <strong className="text-[var(--st-text)]">{jobs.filter(j => j.status === 'Unassigned').length}</strong></span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4 flex gap-4 items-start">
        {columns.map(col => {
          const colJobs = jobs.filter(j => j.status === col.id).slice(0, 15);
          return (
            <div key={col.id} className="w-80 shrink-0 flex flex-col max-h-full bg-[var(--st-bg)] rounded-[var(--st-radius-lg)] border border-[var(--st-border)]">
              <div className="p-3 border-b border-[var(--st-border)] flex justify-between items-center">
                <h3 className="font-semibold text-[var(--st-text)] flex items-center gap-2">
                  <Dot tone={col.tone} aria-hidden="true" />
                  {col.title}
                </h3>
                <Badge tone="neutral">{colJobs.length}</Badge>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {colJobs.map(job => (
                  <Card key={job.id} variant="interactive" padding="sm">
                    <div className="flex justify-between items-start mb-2">
                      <Badge tone={getPriorityTone(job.priority)}>{job.priority}</Badge>
                      <span className="text-xs text-[var(--st-text-secondary)] font-mono">{job.id}</span>
                    </div>
                    <h4 className="font-medium text-[var(--st-text)] text-sm mb-1">{job.title}</h4>
                    <p className="text-xs text-[var(--st-text-secondary)] mb-3 truncate">{job.customer}</p>

                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-[var(--st-border)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {job.time}
                      </div>
                      {job.technicianId ? (
                        <Avatar shape="round" size="xs">
                          <AvatarImage src={`https://i.pravatar.cc/150?u=${job.technicianId}`} alt={`Technician ${job.technicianId}`} />
                          <AvatarFallback>{job.technicianId.slice(-2)}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => toast.success(`Assigning ${job.id}`)}>Assign</Button>
                      )}
                    </div>
                  </Card>
                ))}
                {colJobs.length === 0 && (
                  <EmptyState icon={Briefcase} size="sm" title="No jobs in this queue" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JobQueueTab({ jobs }: { jobs: any[] }) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const pageJobs = jobs.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="h-full flex flex-col bg-[var(--st-bg)]">
      {/* Toolbar */}
      <div className="p-4 border-b border-[var(--st-border)] flex flex-wrap gap-4 justify-between items-center bg-[var(--st-bg-secondary)]">
        <div className="flex items-center gap-2">
          <Input type="text" iconLeft={Search} placeholder="Search in queue..." aria-label="Search in queue" className="w-64" />
          <IconButton label="Filter queue" icon={Filter} variant="secondary" />
          <IconButton label="Download queue" icon={Download} variant="secondary" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--st-text-secondary)] mr-2">Selected: 0</span>
          <Button variant="secondary" size="sm" disabled>Bulk Assign</Button>
          <Button variant="secondary" size="sm" disabled>Change Status</Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto">
        <Table stickyHeader hover>
          <THead>
            <Tr>
              <Th width={48} align="center"><Checkbox aria-label="Select all jobs" /></Th>
              <Th>Job ID</Th>
              <Th>Details</Th>
              <Th>Customer & Location</Th>
              <Th>Status</Th>
              <Th>Priority</Th>
              <Th>Schedule</Th>
              <Th>Technician</Th>
              <Th align="right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {pageJobs.map((job) => (
              <Tr key={job.id}>
                <Td align="center"><Checkbox aria-label={`Select ${job.id}`} /></Td>
                <Td>
                  <span className="font-mono text-xs text-[var(--st-accent)]">{job.id}</span>
                </Td>
                <Td>
                  <div className="font-medium text-[var(--st-text)] text-sm">{job.title}</div>
                  <div className="text-xs text-[var(--st-text-secondary)] mt-0.5">{job.type}</div>
                </Td>
                <Td>
                  <div className="text-sm text-[var(--st-text)]">{job.customer}</div>
                  <div className="text-xs text-[var(--st-text-secondary)] mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" aria-hidden="true" /> {job.address}</div>
                </Td>
                <Td>
                  <Badge tone={getStatusTone(job.status)}>{job.status}</Badge>
                </Td>
                <Td>
                  <Badge tone={getPriorityTone(job.priority)}>{job.priority}</Badge>
                </Td>
                <Td>
                  <div className="text-sm text-[var(--st-text)]">{job.date}</div>
                  <div className="text-xs text-[var(--st-text-secondary)] mt-0.5">{job.time}</div>
                </Td>
                <Td>
                  {job.technicianId ? (
                    <div className="flex items-center gap-2">
                      <Avatar shape="round" size="xs">
                        <AvatarImage src={`https://i.pravatar.cc/150?u=${job.technicianId}`} alt={`Technician ${job.technicianId}`} />
                        <AvatarFallback>{job.technicianId.slice(-2)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-[var(--st-text-secondary)]">{job.technicianId}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--st-text-tertiary)] italic">Unassigned</span>
                  )}
                </Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton label={`Edit ${job.id}`} icon={Edit2} size="sm" onClick={() => toast.info(`Editing ${job.id}`)} />
                    <IconButton label={`More options for ${job.id}`} icon={MoreVertical} size="sm" />
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-between text-sm text-[var(--st-text-secondary)]">
        <div>Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, jobs.length)} of {jobs.length} entries</div>
        <Pagination
          page={page}
          pageCount={Math.ceil(jobs.length / pageSize)}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

function TechniciansTab({ technicians }: { technicians: any[] }) {
  const { toast } = useToast();
  return (
    <div className="h-full flex flex-col bg-[var(--st-bg)] overflow-y-auto">
      <PageHeader className="px-6">
        <PageHeaderHeading>
          <PageTitle>Fleet & Technician Management</PageTitle>
          <PageDescription>Monitor, dispatch, and manage your field workforce.</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button variant="secondary" iconLeft={Plus} onClick={() => toast.success("Add technician")}>Add Technician</Button>
        </PageActions>
      </PageHeader>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {technicians.map((tech) => {
          const statusTone: BadgeTone =
            tech.status === 'Active' ? 'success' :
            tech.status === 'On Break' ? 'warning' :
            tech.status === 'Emergency' ? 'danger' : 'neutral';
          return (
            <Card key={tech.id} variant="outlined" padding="lg" className="relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3">
                  <div className="relative">
                    <Avatar shape="round" size="lg">
                      <AvatarImage src={tech.avatar} alt={tech.name} />
                      <AvatarFallback>{tech.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0"><Dot tone={statusTone} aria-hidden="true" /></span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--st-text)]">{tech.name}</h3>
                    <div className="text-xs text-[var(--st-text-secondary)] font-mono mt-0.5">{tech.id}</div>
                  </div>
                </div>
                <IconButton label={`More options for ${tech.name}`} icon={MoreVertical} size="sm" />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] p-2.5 border border-[var(--st-border)]">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--st-text-secondary)] mb-1">Rating</div>
                  <div className="text-sm font-medium text-[var(--st-warn)] flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-current" aria-hidden="true" /> {tech.rating}</div>
                </div>
                <div className="bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] p-2.5 border border-[var(--st-border)]">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--st-text-secondary)] mb-1">Jobs Done</div>
                  <div className="text-sm font-medium text-[var(--st-text)]">{tech.jobsCompleted}</div>
                </div>
              </div>

              <div className="space-y-2.5 mb-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--st-text-secondary)] flex items-center gap-2"><Truck className="w-4 h-4" aria-hidden="true" /> Vehicle</span>
                  <span className="text-[var(--st-text)]">{tech.vehicle}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--st-text-secondary)] flex items-center gap-2"><Smartphone className="w-4 h-4" aria-hidden="true" /> Device</span>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 text-xs ${tech.battery < 20 ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-secondary)]'}`}><Battery className="w-3 h-3" aria-hidden="true" /> {tech.battery}%</span>
                    <span className="flex items-center gap-1 text-xs text-[var(--st-text-secondary)]"><Signal className="w-3 h-3" aria-hidden="true" /> {tech.signal}/4</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--st-text-secondary)] flex items-center gap-2"><Clock className="w-4 h-4" aria-hidden="true" /> Last Seen</span>
                  <span className="text-[var(--st-text)] text-xs">{tech.lastSeen}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {tech.skills.map((skill: string) => (
                  <Badge key={skill} tone="neutral">{skill}</Badge>
                ))}
              </div>

              <div className="pt-4 border-t border-[var(--st-border)] flex gap-2">
                <Button variant="outline" block size="sm" onClick={() => toast.success(`Assigning job to ${tech.name}`)}>
                  Assign Job
                </Button>
                <IconButton label={`Message ${tech.name}`} icon={MessageSquare} variant="secondary" />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
