"use client";

import React, { useState, useEffect } from "react";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneOff,
  PhoneMissed,
  PhoneForwarded,
  Mic,
  MicOff,
  Play,
  Pause,
  Headphones,
  Settings,
  Users,
  UserPlus,
  Clock,
  Activity,
  MessageSquare,
  MoreHorizontal,
  MoreVertical,
  Search,
  Filter,
  Plus,
  AlertCircle,
  Info,
  Zap,
  Shield,
  Globe,
  List,
  Box,
  Cpu,
  Database,
  Server,
  ArrowRight,
  ArrowLeft,
  Save,
  Download,
  Layers,
  Move,
  GitMerge,
  GitBranch,
  MapPin,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  StatCard,
  Badge,
  Dot,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Field,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Callout,
  EmptyState,
} from "@/components/sabcrm/20ui";

// --- MOCK DATA ---

const MOCK_QUEUE_STATS = [
  { id: 1, label: "Calls in Queue", value: "24", trend: "+12%", trendUp: true },
  { id: 2, label: "Avg Wait Time", value: "01:45", trend: "-5s", trendUp: true },
  { id: 3, label: "Active Agents", value: "142", trend: "+3", trendUp: true },
  { id: 4, label: "Abandon Rate", value: "4.2%", trend: "-0.8%", trendUp: true },
  { id: 5, label: "Avg Handle Time", value: "05:20", trend: "+12s", trendUp: false },
  { id: 6, label: "Service Level", value: "92%", trend: "+2%", trendUp: true },
];

const MOCK_ACTIVE_CALLS = Array.from({ length: 15 }).map((_, i) => ({
  id: `call-${i + 1}`,
  caller: [
    "Alice Johnson",
    "Bob Smith",
    "Charlie Davis",
    "Diana Evans",
    "Ethan Foster",
    "Fiona Garcia",
    "George Harris",
    "Hannah Irvine",
    "Ian Jones",
    "Julia King",
  ][i % 10],
  number: `+1 (555) ${100 + ((i * 37) % 900)}-${1000 + ((i * 211) % 9000)}`,
  queue: ["Support", "Billing", "Sales", "Technical", "VIP Escalation"][i % 5],
  agent: [
    "Sarah Connor",
    "John Doe",
    "Jane Roe",
    "Michael Scott",
    "Pam Beesly",
    "Jim Halpert",
    "Dwight Schrute",
  ][i % 7] || "Unassigned",
  status: (["In Progress", "In Queue", "On Hold", "Ringing"] as const)[i % 4],
  duration: `${(i % 15)}:${((i * 7) % 60).toString().padStart(2, "0")}`,
  sentiment: (["Positive", "Neutral", "Negative"] as const)[i % 3],
}));

const MOCK_TRANSCRIPTION = [
  { id: 1, speaker: "Agent", text: "Thank you for calling SabDesk support. My name is Sarah. How can I help you today?", time: "00:01", sentiment: "Neutral" },
  { id: 2, speaker: "Customer", text: "Hi Sarah, I'm having trouble logging into my dashboard. It keeps saying invalid credentials but I just reset my password.", time: "00:08", sentiment: "Negative" },
  { id: 3, speaker: "Agent", text: "I'm sorry to hear that. I can certainly help you with that. Could you please provide your account email address?", time: "00:15", sentiment: "Positive" },
  { id: 4, speaker: "Customer", text: "Sure, it's customer@example.com.", time: "00:22", sentiment: "Neutral" },
  { id: 5, speaker: "Agent", text: "Thank you. Let me pull up your account. Okay, I see the password reset. It looks like the system locked your account due to multiple failed attempts prior to the reset.", time: "00:26", sentiment: "Neutral" },
  { id: 6, speaker: "Customer", text: "Oh, that makes sense. I was trying to remember my old password. Can you unlock it for me?", time: "00:40", sentiment: "Neutral" },
  { id: 7, speaker: "Agent", text: "Absolutely. I've just removed the lock. You should be able to log in now with your new password. Would you like to try it while I'm still on the line?", time: "00:48", sentiment: "Positive" },
  { id: 8, speaker: "Customer", text: "Let me check. Yes, I'm in. Thank you so much, that was really fast.", time: "00:58", sentiment: "Positive" },
  { id: 9, speaker: "Agent", text: "You're very welcome. Is there anything else I can assist you with today?", time: "01:05", sentiment: "Positive" },
];

const MOCK_IVR_NODES = [
  { id: "node-1", type: "trigger", title: "Incoming Call", desc: "Trigger on all inbound calls", x: 100, y: 50 },
  { id: "node-2", type: "menu", title: "Main Menu", desc: "Press 1 for Support, 2 for Sales", x: 100, y: 200 },
  { id: "node-3", type: "route", title: "Route to Support", desc: "Queue: Technical Support", x: -100, y: 350 },
  { id: "node-4", type: "route", title: "Route to Sales", desc: "Queue: Inbound Sales", x: 300, y: 350 },
  { id: "node-5", type: "condition", title: "Business Hours?", desc: "Check schedule US Mon-Fri", x: -100, y: 500 },
  { id: "node-6", type: "voicemail", title: "Support Voicemail", desc: "Leave a message", x: -250, y: 650 },
  { id: "node-7", type: "agent", title: "Ring Support Agents", desc: "Strategy: Round Robin", x: 50, y: 650 },
];

const TABS = [
  { id: "active-calls", label: "Active & Queue", icon: Layers },
  { id: "dialer", label: "WebRTC Dialer", icon: PhoneCall },
  { id: "ivr", label: "IVR Visual Builder", icon: GitMerge },
  { id: "transcription", label: "Live Transcriptions", icon: MessageSquare },
  { id: "agents", label: "Agent Performance", icon: Users },
  { id: "settings", label: "PBX Settings", icon: Settings },
];

export default function VoiceCenterDashboard() {
  const [activeTab, setActiveTab] = useState("active-calls");
  const [isDialerOpen, setIsDialerOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState("");
  const [callState, setCallState] = useState("idle"); // idle, calling, connected, hold
  const [callDuration, setCallDuration] = useState(0);

  // Dialer timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callState === "connected") {
      interval = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleDial = () => {
    if (!dialNumber) return;
    setCallState("calling");
    setTimeout(() => {
      setCallState("connected");
    }, 2000);
  };

  const handleHangup = () => {
    setCallState("idle");
    setDialNumber("");
  };

  return (
    <div className="ui20 dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] flex flex-col">
      {/* HEADER */}
      <header className="h-16 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-[var(--st-radius)] bg-[var(--st-accent)] flex items-center justify-center">
            <Headphones size={18} className="text-white" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-[var(--st-text)]">SabDesk Voice Center</h1>
          <div className="h-4 w-px bg-[var(--st-border)] mx-2" />
          <div className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)]">
            <span className="flex items-center gap-1.5">
              <Dot tone="success" pulse aria-hidden="true" />
              System Operational
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-64">
            <Field label="" className="!gap-0">
              <Input
                type="text"
                inputSize="sm"
                iconLeft={Search}
                placeholder="Search calls, agents, numbers..."
                aria-label="Search calls, agents, numbers"
              />
            </Field>
          </div>
          <IconButton
            icon={PhoneCall}
            label="Open dialer"
            variant={isDialerOpen ? "primary" : "ghost"}
            onClick={() => setIsDialerOpen(!isDialerOpen)}
          />
          <IconButton icon={Settings} label="Settings" />
          <div className="w-8 h-8 rounded-[var(--st-radius-pill)] bg-[var(--st-accent)] border border-[var(--st-border)] cursor-pointer" />
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        {/* SUB-HEADER TABS */}
        <div className="px-6 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] overflow-x-auto">
          <TabsList className="min-w-max">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                <span className="flex items-center gap-2">
                  <tab.icon size={16} aria-hidden="true" />
                  {tab.label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <main className="flex-1 overflow-hidden relative flex flex-col p-6 gap-6">
          {/* TAB CONTENT: ACTIVE CALLS */}
          <TabsContent value="active-calls" className="flex flex-col h-full gap-6 m-0">
            {/* STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {MOCK_QUEUE_STATS.map((stat) => (
                <StatCard
                  key={stat.id}
                  label={stat.label}
                  value={stat.value}
                  delta={{ value: stat.trend, tone: stat.trendUp ? "up" : "down" }}
                />
              ))}
            </div>

            {/* CALLS TABLE */}
            <Card padding="none" className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="text-[var(--st-accent)]" size={18} aria-hidden="true" />
                  Live Operations Center
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" iconLeft={Filter}>
                    Filter
                  </Button>
                  <Button variant="primary" size="sm" iconLeft={Download}>
                    Export
                  </Button>
                </div>
              </CardHeader>
              <div className="flex-1 overflow-auto">
                <Table stickyHeader hover>
                  <THead>
                    <Tr>
                      <Th>Caller</Th>
                      <Th>Number</Th>
                      <Th>Queue</Th>
                      <Th>Agent</Th>
                      <Th>Status</Th>
                      <Th>Duration</Th>
                      <Th>Sentiment</Th>
                      <Th align="right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {MOCK_ACTIVE_CALLS.map((call) => (
                      <Tr key={call.id} className="group">
                        <Td>
                          <span className="flex items-center gap-3 font-medium text-[var(--st-text)]">
                            <span className="w-8 h-8 rounded-[var(--st-radius-pill)] bg-[var(--st-bg-secondary)] border border-[var(--st-border)] flex items-center justify-center text-xs font-bold text-[var(--st-text-secondary)]">
                              {call.caller.charAt(0)}
                            </span>
                            {call.caller}
                          </span>
                        </Td>
                        <Td className="text-[var(--st-text-secondary)] font-mono text-xs">{call.number}</Td>
                        <Td>
                          <Badge tone="accent">{call.queue}</Badge>
                        </Td>
                        <Td>
                          <span className="flex items-center gap-2">
                            {call.agent !== "Unassigned" ? (
                              <>
                                <Dot tone="success" aria-hidden="true" />
                                <span className="text-[var(--st-text)]">{call.agent}</span>
                              </>
                            ) : (
                              <>
                                <Dot tone="warning" pulse aria-hidden="true" />
                                <span className="text-[var(--st-warn)] italic">Unassigned</span>
                              </>
                            )}
                          </span>
                        </Td>
                        <Td>
                          {call.status === "In Progress" && (
                            <span className="text-[var(--st-status-ok)] flex items-center gap-1.5">
                              <PhoneCall size={14} aria-hidden="true" /> {call.status}
                            </span>
                          )}
                          {call.status === "In Queue" && (
                            <span className="text-[var(--st-warn)] flex items-center gap-1.5">
                              <Clock size={14} aria-hidden="true" /> {call.status}
                            </span>
                          )}
                          {call.status === "On Hold" && (
                            <span className="text-[var(--st-warn)] flex items-center gap-1.5">
                              <Pause size={14} aria-hidden="true" /> {call.status}
                            </span>
                          )}
                          {call.status === "Ringing" && (
                            <span className="text-[var(--st-accent)] flex items-center gap-1.5">
                              <PhoneIncoming size={14} aria-hidden="true" /> {call.status}
                            </span>
                          )}
                        </Td>
                        <Td className="font-mono text-[var(--st-text)]">{call.duration}</Td>
                        <Td>
                          {call.sentiment === "Positive" && <span className="text-[var(--st-status-ok)]">Positive</span>}
                          {call.sentiment === "Neutral" && <span className="text-[var(--st-text-secondary)]">Neutral</span>}
                          {call.sentiment === "Negative" && <span className="text-[var(--st-danger)] font-medium">Negative</span>}
                        </Td>
                        <Td align="right">
                          <span className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <IconButton icon={Headphones} label="Listen in" size="sm" />
                            <IconButton icon={PhoneForwarded} label="Transfer" size="sm" />
                            <IconButton icon={PhoneOff} label="Drop call" size="sm" variant="danger" />
                            <IconButton icon={MoreVertical} label="More actions" size="sm" />
                          </span>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* TAB CONTENT: WEBRTC DIALER */}
          <TabsContent value="dialer" className="flex h-full gap-6 items-center justify-center m-0">
            <Card padding="none" className="w-[400px] h-[750px] flex flex-col overflow-hidden relative">
              {/* Dialer Header */}
              <div className="h-16 border-b border-[var(--st-border)] flex items-center justify-between px-6 bg-[var(--st-bg-secondary)]">
                <div className="flex items-center gap-2">
                  <Dot tone="success" aria-hidden="true" />
                  <span className="text-sm font-medium text-[var(--st-text)]">Agent Online</span>
                </div>
                <div className="flex gap-3 items-center text-[var(--st-text-secondary)]">
                  <SignalIcon strength={4} />
                  <IconButton icon={Settings} label="Dialer settings" size="sm" />
                </div>
              </div>

              {/* Dialer Display */}
              <div className="flex flex-col items-center justify-center py-10 px-8 flex-shrink-0">
                <div className="text-sm text-[var(--st-text-secondary)] mb-2 font-medium tracking-wide uppercase">
                  {callState === "idle" ? "Enter Number" : callState === "calling" ? "Calling..." : "Connected"}
                </div>
                <div className="text-4xl font-light text-center text-[var(--st-text)] w-full tracking-wider h-12 flex items-center justify-center">
                  {dialNumber || <span className="text-[var(--st-text-tertiary)]">(555) 000-0000</span>}
                </div>
                {callState === "connected" && (
                  <Badge tone="accent" className="mt-4 font-mono text-base">
                    {formatTime(callDuration)}
                  </Badge>
                )}
              </div>

              {/* Call Actions (In call) */}
              <div className={`px-8 transition-all duration-300 overflow-hidden ${callState !== "idle" ? "h-24 opacity-100" : "h-0 opacity-0"}`}>
                <div className="grid grid-cols-4 gap-4">
                  <DialerAction icon={MicOff} label="Mute" />
                  <DialerAction icon={Pause} label="Hold" />
                  <DialerAction icon={Plus} label="Add" />
                  <DialerAction icon={MoreHorizontal} label="More" />
                </div>
              </div>

              {/* Keypad */}
              <div className="flex-1 px-10 py-4 grid grid-cols-3 gap-y-6 gap-x-8 items-center justify-items-center">
                <KeypadButton digit="1" letters="" onClick={() => setDialNumber((prev) => prev + "1")} />
                <KeypadButton digit="2" letters="ABC" onClick={() => setDialNumber((prev) => prev + "2")} />
                <KeypadButton digit="3" letters="DEF" onClick={() => setDialNumber((prev) => prev + "3")} />
                <KeypadButton digit="4" letters="GHI" onClick={() => setDialNumber((prev) => prev + "4")} />
                <KeypadButton digit="5" letters="JKL" onClick={() => setDialNumber((prev) => prev + "5")} />
                <KeypadButton digit="6" letters="MNO" onClick={() => setDialNumber((prev) => prev + "6")} />
                <KeypadButton digit="7" letters="PQRS" onClick={() => setDialNumber((prev) => prev + "7")} />
                <KeypadButton digit="8" letters="TUV" onClick={() => setDialNumber((prev) => prev + "8")} />
                <KeypadButton digit="9" letters="WXYZ" onClick={() => setDialNumber((prev) => prev + "9")} />
                <KeypadButton digit="*" letters="" onClick={() => setDialNumber((prev) => prev + "*")} />
                <KeypadButton digit="0" letters="+" onClick={() => setDialNumber((prev) => prev + "0")} />
                <KeypadButton digit="#" letters="" onClick={() => setDialNumber((prev) => prev + "#")} />
              </div>

              {/* Main Call Button */}
              <div className="p-8 flex justify-center gap-6 relative items-center">
                {callState === "idle" ? (
                  <IconButton
                    icon={Phone}
                    label="Start call"
                    variant="primary"
                    onClick={handleDial}
                    className="!w-16 !h-16 !rounded-[var(--st-radius-pill)]"
                  />
                ) : (
                  <IconButton
                    icon={PhoneOff}
                    label="Hang up"
                    variant="danger"
                    onClick={handleHangup}
                    className="!w-16 !h-16 !rounded-[var(--st-radius-pill)]"
                  />
                )}

                {callState === "idle" && dialNumber.length > 0 && (
                  <IconButton
                    icon={ArrowLeft}
                    label="Delete digit"
                    onClick={() => setDialNumber((prev) => prev.slice(0, -1))}
                    className="!absolute !right-12 !top-1/2 !-translate-y-1/2 !w-12 !h-12 !rounded-[var(--st-radius-pill)]"
                  />
                )}
              </div>
            </Card>

            {/* Context Panel for Dialer */}
            <Card padding="none" className="w-[450px] h-[750px] flex flex-col overflow-hidden">
              <div className="p-4 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1 !text-[var(--st-accent)]">Recent</Button>
                <Button variant="ghost" size="sm" className="flex-1">Contacts</Button>
                <Button variant="ghost" size="sm" className="flex-1">Voicemail</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <div key={i} className="p-3 rounded-[var(--st-radius)] hover:bg-[var(--st-bg-secondary)] flex items-center gap-4 cursor-pointer transition-colors border border-transparent hover:border-[var(--st-border)]">
                    <span className={`w-10 h-10 rounded-[var(--st-radius-pill)] flex items-center justify-center ${i % 3 === 0 ? "bg-[var(--st-danger-soft)] text-[var(--st-danger)]" : "bg-[var(--st-accent-soft)] text-[var(--st-status-ok)]"}`}>
                      {i % 3 === 0 ? <PhoneMissed size={18} aria-hidden="true" /> : i % 2 === 0 ? <PhoneIncoming size={18} aria-hidden="true" /> : <PhoneOutgoing size={18} aria-hidden="true" />}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium text-[var(--st-text)]">{["John Smith", "Alice Cooper", "+1 (555) 987-6543", "Unknown"][i % 4]}</div>
                      <div className="text-xs text-[var(--st-text-secondary)] flex items-center gap-2">
                        {i % 3 !== 0 && <span>{(i * 2) % 10}m {(i * 11) % 60}s</span>}
                        <span>-</span>
                        <span>{i} hour{i > 1 ? "s" : ""} ago</span>
                      </div>
                    </div>
                    <IconButton icon={PhoneCall} label="Call back" size="sm" />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* TAB CONTENT: IVR VISUAL BUILDER */}
          <TabsContent value="ivr" className="flex-1 flex gap-4 h-full overflow-hidden m-0">
            {/* Sidebar Tools */}
            <Card padding="none" className="w-64 flex flex-col overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Box size={16} className="text-[var(--st-accent)]" aria-hidden="true" />
                  Nodes Palette
                </CardTitle>
              </CardHeader>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                <div className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-2 mt-2 px-1">Triggers</div>
                <IVRPaletteItem icon={PhoneIncoming} label="Incoming Call" tone="success" />
                <IVRPaletteItem icon={Clock} label="Schedule" tone="success" />

                <div className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-2 mt-4 px-1">Logic</div>
                <IVRPaletteItem icon={GitBranch} label="Condition" tone="warning" />
                <IVRPaletteItem icon={List} label="Menu (IVR)" tone="warning" />
                <IVRPaletteItem icon={Database} label="Data Lookup" tone="warning" />

                <div className="text-xs font-semibold text-[var(--st-text-tertiary)] uppercase tracking-wider mb-2 mt-4 px-1">Actions</div>
                <IVRPaletteItem icon={Play} label="Play Audio" tone="accent" />
                <IVRPaletteItem icon={Mic} label="Record Voicemail" tone="accent" />
                <IVRPaletteItem icon={Users} label="Route to Queue" tone="accent" />
                <IVRPaletteItem icon={PhoneForwarded} label="External Forward" tone="accent" />
                <IVRPaletteItem icon={MessageSquare} label="Send SMS" tone="accent" />
              </div>
            </Card>

            {/* Canvas Area */}
            <Card padding="none" className="flex-1 relative overflow-hidden flex flex-col">
              {/* Toolbar */}
              <div className="h-12 border-b border-[var(--st-border)] flex justify-between items-center px-4 bg-[var(--st-bg-secondary)] absolute top-0 left-0 right-0 z-10">
                <div className="flex items-center gap-4 text-sm font-medium text-[var(--st-text)]">
                  <span className="flex items-center gap-2">
                    <Dot tone="success" aria-hidden="true" /> Main Support Flow
                  </span>
                  <Badge tone="neutral">v2.4 Draft</Badge>
                </div>
                <div className="flex gap-2 items-center">
                  <IconButton icon={Move} label="Pan canvas" size="sm" />
                  <IconButton icon={ZoomIn} label="Zoom in" size="sm" />
                  <IconButton icon={ZoomOut} label="Zoom out" size="sm" />
                  <div className="w-px h-6 bg-[var(--st-border)] mx-1" />
                  <Button variant="primary" size="sm" iconLeft={Save}>
                    Publish Flow
                  </Button>
                </div>
              </div>

              {/* Grid Background */}
              <div className="absolute inset-0 z-0 [background-image:radial-gradient(circle_at_1px_1px,var(--st-border)_1px,transparent_0)] [background-size:24px_24px] [background-position:center_center]" />

              {/* Nodes rendering (Mocked layout) */}
              <div className="absolute inset-0 mt-12 z-0 overflow-auto flex items-center justify-center p-20">
                <div className="relative w-full max-w-4xl h-[600px]">
                  {/* SVG for edges */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" aria-hidden="true">
                    <path d="M 150 110 L 150 150 L 150 200" stroke="var(--st-border-strong)" strokeWidth="2" fill="none" strokeDasharray="4 2" />
                    <path d="M 150 260 L 150 300 L -50 300 L -50 350" stroke="var(--st-border-strong)" strokeWidth="2" fill="none" />
                    <path d="M 150 260 L 150 300 L 350 300 L 350 350" stroke="var(--st-border-strong)" strokeWidth="2" fill="none" />
                    <path d="M -50 410 L -50 450 L -50 500" stroke="var(--st-border-strong)" strokeWidth="2" fill="none" />
                    <path d="M -50 560 L -50 600 L -200 600 L -200 650" stroke="var(--st-border-strong)" strokeWidth="2" fill="none" />
                    <path d="M -50 560 L -50 600 L 100 600 L 100 650" stroke="var(--st-border-strong)" strokeWidth="2" fill="none" />
                  </svg>

                  {/* Nodes */}
                  {MOCK_IVR_NODES.map((node) => (
                    <div
                      key={node.id}
                      className="absolute w-56 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius-lg)] shadow-[var(--st-shadow)] transform -translate-x-1/2 -translate-y-1/2 cursor-move hover:border-[var(--st-accent)] transition-colors z-10"
                      style={{ left: `calc(50% + ${node.x}px)`, top: node.y }}
                    >
                      <div className="flex items-center gap-3 p-3 border-b border-[var(--st-border)]">
                        <span className={`w-8 h-8 rounded-[var(--st-radius)] flex items-center justify-center ${
                          node.type === "trigger" ? "bg-[var(--st-accent-soft)] text-[var(--st-status-ok)]" :
                          node.type === "menu" ? "bg-[var(--st-accent-soft)] text-[var(--st-warn)]" :
                          node.type === "route" || node.type === "agent" ? "bg-[var(--st-accent-soft)] text-[var(--st-accent)]" :
                          node.type === "voicemail" ? "bg-[var(--st-accent-soft)] text-[var(--st-accent)]" :
                          "bg-[var(--st-bg)] text-[var(--st-text-secondary)]"
                        }`}>
                          {node.type === "trigger" && <PhoneIncoming size={16} aria-hidden="true" />}
                          {node.type === "menu" && <List size={16} aria-hidden="true" />}
                          {node.type === "route" && <ArrowRight size={16} aria-hidden="true" />}
                          {node.type === "agent" && <Users size={16} aria-hidden="true" />}
                          {node.type === "voicemail" && <Mic size={16} aria-hidden="true" />}
                          {node.type === "condition" && <GitBranch size={16} aria-hidden="true" />}
                        </span>
                        <div className="text-sm font-semibold text-[var(--st-text)]">{node.title}</div>
                      </div>
                      <div className="p-3">
                        <div className="text-xs text-[var(--st-text-secondary)]">{node.desc}</div>
                      </div>

                      {/* Connection Points */}
                      {node.type !== "trigger" && <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-[var(--st-radius-pill)] bg-[var(--st-bg)] border-2 border-[var(--st-border)] z-20" />}
                      {node.type !== "voicemail" && node.type !== "agent" && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 rounded-[var(--st-radius-pill)] bg-[var(--st-accent)] border-2 border-[var(--st-bg)] z-20 cursor-crosshair" />}
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Properties Panel */}
            <Card padding="none" className="w-80 flex flex-col overflow-hidden">
              <CardHeader className="flex justify-between items-center">
                <CardTitle className="text-base">Properties</CardTitle>
                <Settings size={16} className="text-[var(--st-text-secondary)]" aria-hidden="true" />
              </CardHeader>
              <div className="p-4 flex flex-col gap-4 overflow-y-auto">
                <Callout tone="info" icon={Info}>
                  Select a node on the canvas to edit its properties, routing logic, and media settings.
                </Callout>

                {/* Mock selected node properties */}
                <div className="space-y-4 opacity-50 pointer-events-none">
                  <Field label="Node Name">
                    <Input type="text" inputSize="sm" value="Main Menu" readOnly />
                  </Field>
                  <Field label="Audio Prompt">
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <Select disabled defaultValue="tts-neural">
                          <SelectTrigger aria-label="Audio prompt source">
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tts-neural">Text-to-Speech (Neural)</SelectItem>
                            <SelectItem value="tts-standard">Text-to-Speech (Standard)</SelectItem>
                            <SelectItem value="upload">Uploaded Audio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <IconButton icon={Mic} label="Record prompt" size="sm" disabled />
                    </div>
                  </Field>
                  <Field label="TTS Message">
                    <Textarea
                      rows={4}
                      value="Welcome to SabDesk. Press 1 for Support, 2 for Sales, or stay on the line for an operator."
                      readOnly
                    />
                  </Field>
                  <Field label="Key Presses">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-[var(--st-bg)] p-2 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                        <span className="w-6 h-6 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius-sm)] flex items-center justify-center text-xs font-mono font-bold text-[var(--st-text)]">1</span>
                        <ArrowRight size={14} className="text-[var(--st-text-tertiary)]" aria-hidden="true" />
                        <span className="text-sm text-[var(--st-text)] flex-1 truncate">Route to Support</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[var(--st-bg)] p-2 rounded-[var(--st-radius)] border border-[var(--st-border)]">
                        <span className="w-6 h-6 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius-sm)] flex items-center justify-center text-xs font-mono font-bold text-[var(--st-text)]">2</span>
                        <ArrowRight size={14} className="text-[var(--st-text-tertiary)]" aria-hidden="true" />
                        <span className="text-sm text-[var(--st-text)] flex-1 truncate">Route to Sales</span>
                      </div>
                      <Button variant="outline" size="sm" block iconLeft={Plus}>
                        Add Option
                      </Button>
                    </div>
                  </Field>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* TAB CONTENT: LIVE TRANSCRIPTIONS */}
          <TabsContent value="transcription" className="flex h-full gap-6 m-0">
            {/* Active Calls List */}
            <Card padding="none" className="w-80 flex flex-col overflow-hidden">
              <CardHeader className="flex justify-between items-center">
                <CardTitle className="text-base">Live AI Analysis</CardTitle>
                <Dot tone="success" pulse aria-hidden="true" />
              </CardHeader>
              <div className="p-3 border-b border-[var(--st-border)]">
                <Field label="">
                  <Input type="text" inputSize="sm" iconLeft={Search} placeholder="Search keywords..." aria-label="Search keywords" />
                </Field>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={`p-3 rounded-[var(--st-radius)] cursor-pointer transition-colors border ${i === 1 ? "bg-[var(--st-accent-soft)] border-[var(--st-accent)]" : "hover:bg-[var(--st-bg-secondary)] border-transparent"}`}>
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium text-[var(--st-text)] text-sm">{["Alice Johnson", "Bob Smith", "Corporate Inc", "VIP Client", "Unknown"][i - 1]}</div>
                      <Badge tone={i === 1 || i === 4 ? "success" : "danger"}>
                        {i === 1 || i === 4 ? "Positive" : "Frustrated"}
                      </Badge>
                    </div>
                    <div className="text-xs text-[var(--st-text-secondary)] flex items-center justify-between">
                      <span className="flex items-center gap-1"><Headphones size={12} aria-hidden="true" /> Sarah C.</span>
                      <span className="font-mono">0{i}:24</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Main Transcription View */}
            <Card padding="none" className="flex-1 flex flex-col overflow-hidden relative">
              {/* Header */}
              <div className="h-16 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex justify-between items-center px-6">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--st-text)] flex items-center gap-3">
                    Alice Johnson
                    <Badge tone="accent">Support Queue</Badge>
                  </h2>
                  <div className="text-xs text-[var(--st-text-secondary)] flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1"><Clock size={12} aria-hidden="true" /> Started 01:05 ago</span>
                    <span className="flex items-center gap-1"><MapPin size={12} aria-hidden="true" /> New York, US</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" iconLeft={Zap}>AI Suggestion</Button>
                  <Button variant="primary" iconLeft={UserPlus}>Barge In</Button>
                </div>
              </div>

              {/* Feed & Insights Layout */}
              <div className="flex-1 flex overflow-hidden">
                {/* Chat Feed */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
                  {MOCK_TRANSCRIPTION.map((msg) => (
                    <div key={msg.id} className={`flex gap-4 max-w-[85%] ${msg.speaker === "Agent" ? "ml-auto flex-row-reverse" : ""}`}>
                      <div className="flex-shrink-0 mt-1">
                        <span className={`w-8 h-8 rounded-[var(--st-radius-pill)] flex items-center justify-center text-xs font-bold ${
                          msg.speaker === "Agent" ? "bg-[var(--st-accent)] text-white" : "bg-[var(--st-bg-secondary)] border border-[var(--st-border)] text-[var(--st-text-secondary)]"
                        }`}>
                          {msg.speaker.charAt(0)}
                        </span>
                      </div>
                      <div className={`flex flex-col ${msg.speaker === "Agent" ? "items-end" : "items-start"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-[var(--st-text-secondary)]">{msg.speaker}</span>
                          <span className="text-[10px] text-[var(--st-text-tertiary)] font-mono">{msg.time}</span>
                        </div>
                        <div className={`p-3 rounded-[var(--st-radius-lg)] text-sm leading-relaxed ${
                          msg.speaker === "Agent"
                            ? "bg-[var(--st-accent)] text-white"
                            : "bg-[var(--st-bg-secondary)] border border-[var(--st-border)] text-[var(--st-text)]"
                        }`}>
                          {highlightKeywords(msg.text)}
                        </div>
                        {msg.sentiment === "Negative" && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-[var(--st-danger)] font-medium">
                            <AlertCircle size={10} aria-hidden="true" /> Frustration detected
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-4 max-w-[85%]">
                    <div className="flex-shrink-0 mt-1">
                      <span className="w-8 h-8 rounded-[var(--st-radius-pill)] bg-[var(--st-bg-secondary)] border border-[var(--st-border)] flex items-center justify-center text-xs font-bold text-[var(--st-text-secondary)]">
                        C
                      </span>
                    </div>
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-[var(--st-text-secondary)]">Customer</span>
                      </div>
                      <div className="p-3 rounded-[var(--st-radius-lg)] bg-[var(--st-bg-secondary)] border border-[var(--st-border)] flex gap-1 items-center h-10">
                        <span className="w-1.5 h-1.5 bg-[var(--st-text-tertiary)] rounded-[var(--st-radius-pill)] animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-[var(--st-text-tertiary)] rounded-[var(--st-radius-pill)] animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-[var(--st-text-tertiary)] rounded-[var(--st-radius-pill)] animate-bounce" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Insights Sidebar */}
                <div className="w-72 border-l border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4 flex flex-col gap-6 overflow-y-auto">
                  {/* Sentiment summary */}
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-3">Overall Sentiment</h4>
                    <div className="flex flex-col items-center gap-2">
                      <div className="text-3xl font-bold text-[var(--st-status-ok)]">78%</div>
                      <Badge tone="success">Positive</Badge>
                    </div>
                  </div>

                  <div className="h-px bg-[var(--st-border)] w-full" />

                  {/* Smart Actions */}
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Zap size={14} className="text-[var(--st-warn)]" aria-hidden="true" /> Suggested Actions
                    </h4>
                    <div className="space-y-2">
                      <Card variant="interactive" padding="sm" className="cursor-pointer">
                        <div className="text-sm font-medium text-[var(--st-text)] mb-1">Send password reset guide</div>
                        <div className="text-xs text-[var(--st-text-secondary)]">Matches: trouble logging in, reset password</div>
                      </Card>
                      <Card variant="interactive" padding="sm" className="cursor-pointer">
                        <div className="text-sm font-medium text-[var(--st-text)] mb-1">Offer security review</div>
                        <div className="text-xs text-[var(--st-text-secondary)]">Based on account lockout history</div>
                      </Card>
                    </div>
                  </div>

                  <div className="h-px bg-[var(--st-border)] w-full" />

                  {/* Extracted Entities */}
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-3">Extracted Data</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="text-[10px] text-[var(--st-text-tertiary)] mb-1">EMAIL</div>
                        <div className="text-sm bg-[var(--st-bg)] px-2 py-1 rounded-[var(--st-radius)] border border-[var(--st-border)] font-mono text-[var(--st-accent)] inline-block">customer@example.com</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[var(--st-text-tertiary)] mb-1">INTENT</div>
                        <div className="flex gap-1 flex-wrap">
                          <Badge tone="accent">Login Issue</Badge>
                          <Badge tone="accent">Account Locked</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* OTHER TABS (Placeholders) */}
          <TabsContent value="agents" className="flex-1 flex items-center justify-center m-0">
            <EmptyState
              icon={Cpu}
              title="Agent Performance"
              description="Module loading. Advanced agents analytics preparing."
            />
          </TabsContent>
          <TabsContent value="settings" className="flex-1 flex items-center justify-center m-0">
            <EmptyState
              icon={Cpu}
              title="PBX Settings"
              description="Module loading. Advanced settings analytics preparing."
            />
          </TabsContent>
        </main>
      </Tabs>

      {/* FOOTER / STATUS BAR */}
      <footer className="h-8 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-between px-4 text-[11px] text-[var(--st-text-tertiary)] font-mono z-50">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5"><Globe size={12} aria-hidden="true" /> region: us-east-1</span>
          <span className="flex items-center gap-1.5"><Server size={12} aria-hidden="true" /> pbx: active (12ms)</span>
          <span className="flex items-center gap-1.5"><Shield size={12} aria-hidden="true" /> e2ee: enabled</span>
        </div>
        <div className="flex gap-4">
          <span>SabDesk CallCenter OS v4.2.0</span>
          <span>(c) 2026</span>
        </div>
      </footer>
    </div>
  );
}

// Sub-components

const IVRPaletteItem = ({ icon: Icon, label, tone }: { icon: any; label: string; tone: "success" | "warning" | "accent" }) => {
  const toneText =
    tone === "success" ? "text-[var(--st-status-ok)]" : tone === "warning" ? "text-[var(--st-warn)]" : "text-[var(--st-accent)]";
  return (
    <div className="p-2.5 rounded-[var(--st-radius)] bg-[var(--st-bg)] border border-[var(--st-border)] hover:border-[var(--st-border-strong)] cursor-grab flex items-center gap-3 transition-colors group">
      <span className={`${toneText} bg-[var(--st-accent-soft)] p-1.5 rounded-[var(--st-radius-sm)]`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="text-sm text-[var(--st-text)]">{label}</span>
      <Move size={14} className="ml-auto text-[var(--st-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
    </div>
  );
};

const DialerAction = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <div className="flex flex-col items-center gap-2">
    <IconButton icon={Icon} label={label} className="!w-12 !h-12 !rounded-[var(--st-radius-lg)]" />
    <span className="text-xs text-[var(--st-text-secondary)] font-medium">{label}</span>
  </div>
);

const KeypadButton = ({ digit, letters, onClick }: { digit: string; letters: string; onClick: () => void }) => (
  <Button
    variant="ghost"
    onClick={onClick}
    aria-label={`Dial ${digit}`}
    className="!w-16 !h-16 !rounded-[var(--st-radius-pill)] !flex-col !p-0"
  >
    <span className="flex flex-col items-center justify-center leading-none">
      <span className="text-3xl font-light text-[var(--st-text)] mb-1">{digit}</span>
      <span className="text-[10px] font-bold text-[var(--st-text-tertiary)] tracking-widest">{letters}</span>
    </span>
  </Button>
);

const SignalIcon = ({ strength }: { strength: number }) => (
  <div className="flex items-end gap-[2px] h-4" aria-hidden="true">
    {[1, 2, 3, 4].map((i) => (
      <span
        key={i}
        className={`w-1 rounded-t-sm ${i <= strength ? "bg-[var(--st-status-ok)]" : "bg-[var(--st-border-strong)]"}`}
        style={{ height: `${i * 25}%` }}
      />
    ))}
  </div>
);

// Helper for highlighting keywords in transcription
const highlightKeywords = (text: string) => {
  const keywords = ["invalid credentials", "reset my password", "customer@example.com", "locked"];
  const parts = text.split(/(invalid credentials|reset my password|customer@example.com|locked)/gi);
  return (
    <>
      {parts.map((part, i) =>
        keywords.includes(part.toLowerCase()) ? (
          <span key={i} className="bg-[var(--st-accent-soft)] text-[var(--st-accent)] px-1 rounded-[var(--st-radius-sm)] font-medium">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
};
