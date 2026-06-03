"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Voicemail,
  Headphones,
  Settings,
  Users,
  UserPlus,
  Clock,
  Calendar,
  BarChart2,
  PieChart,
  Activity,
  MessageSquare,
  MoreHorizontal,
  MoreVertical,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Minus,
  X,
  Check,
  AlertCircle,
  Info,
  Zap,
  Shield,
  Lock,
  Globe,
  List,
  Grid,
  Layout,
  Layers,
  Box,
  Cpu,
  Database,
  Server,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  RefreshCcw,
  Command,
  Edit2,
  Trash2,
  Copy,
  Save,
  Download,
  Upload,
  Share2,
  Link,
  Hash,
  Star,
  CornerDownRight,
  Move,
  GitMerge,
  GitBranch,
  Video,
} from "lucide-react";

// --- MOCK DATA ---

const MOCK_QUEUE_STATS = [
  { id: 1, label: "Calls in Queue", value: "24", trend: "+12%", trendUp: true, color: "text-blue-400" },
  { id: 2, label: "Avg Wait Time", value: "01:45", trend: "-5s", trendUp: true, color: "text-green-400" },
  { id: 3, label: "Active Agents", value: "142", trend: "+3", trendUp: true, color: "text-purple-400" },
  { id: 4, label: "Abandon Rate", value: "4.2%", trend: "-0.8%", trendUp: true, color: "text-emerald-400" },
  { id: 5, label: "Avg Handle Time", value: "05:20", trend: "+12s", trendUp: false, color: "text-amber-400" },
  { id: 6, label: "Service Level", value: "92%", trend: "+2%", trendUp: true, color: "text-cyan-400" },
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
  number: `+1 (555) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`,
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
  status: ["In Progress", "In Queue", "On Hold", "Ringing"][Math.floor(Math.random() * 4)],
  duration: `${Math.floor(Math.random() * 15)}:${Math.floor(Math.random() * 60).toString().padStart(2, "0")}`,
  sentiment: ["Positive", "Neutral", "Negative"][Math.floor(Math.random() * 3)],
}));

const MOCK_TRANSCRIPTION = [
  { id: 1, speaker: "Agent", text: "Thank you for calling SabDesk support. My name is Sarah. How can I help you today?", time: "00:01", sentiment: "Neutral" },
  { id: 2, speaker: "Customer", text: "Hi Sarah, I'm having trouble logging into my dashboard. It keeps saying invalid credentials but I just reset my password.", time: "00:08", sentiment: "Negative" },
  { id: 3, speaker: "Agent", text: "I'm sorry to hear that. I can certainly help you with that. Could you please provide your account email address?", time: "00:15", sentiment: "Positive" },
  { id: 4, speaker: "Customer", text: "Sure, it's customer@example.com.", time: "00:22", sentiment: "Neutral" },
  { id: 5, speaker: "Agent", text: "Thank you. Let me pull up your account... Okay, I see the password reset. It looks like the system locked your account due to multiple failed attempts prior to the reset.", time: "00:26", sentiment: "Neutral" },
  { id: 6, speaker: "Customer", text: "Oh, that makes sense. I was trying to remember my old password. Can you unlock it for me?", time: "00:40", sentiment: "Neutral" },
  { id: 7, speaker: "Agent", text: "Absolutely! I've just removed the lock. You should be able to log in now with your new password. Would you like to try it while I'm still on the line?", time: "00:48", sentiment: "Positive" },
  { id: 8, speaker: "Customer", text: "Let me check... Yes! I'm in. Thank you so much, that was really fast.", time: "00:58", sentiment: "Positive" },
  { id: 9, speaker: "Agent", text: "You're very welcome! Is there anything else I can assist you with today?", time: "01:05", sentiment: "Positive" },
];

const MOCK_IVR_NODES = [
  { id: "node-1", type: "trigger", title: "Incoming Call", desc: "Trigger on all inbound calls", x: 100, y: 50 },
  { id: "node-2", type: "menu", title: "Main Menu", desc: "Press 1 for Support, 2 for Sales", x: 100, y: 200 },
  { id: "node-3", type: "route", title: "Route to Support", desc: "Queue: Technical Support", x: -100, y: 350 },
  { id: "node-4", type: "route", title: "Route to Sales", desc: "Queue: Inbound Sales", x: 300, y: 350 },
  { id: "node-5", type: "condition", title: "Business Hours?", desc: "Check schedule 'US Mon-Fri'", x: -100, y: 500 },
  { id: "node-6", type: "voicemail", title: "Support Voicemail", desc: "Leave a message", x: -250, y: 650 },
  { id: "node-7", type: "agent", title: "Ring Support Agents", desc: "Strategy: Round Robin", x: 50, y: 650 },
];

// --- COMPONENTS ---

const Badge = ({ children, colorClass }: { children: React.ReactNode; colorClass: string }) => (
  <span className={`px-2 py-1 text-xs font-medium rounded-md border ${colorClass} bg-opacity-10 backdrop-blur-md`}>
    {children}
  </span>
);

const IconButton = ({ icon: Icon, onClick, className = "", active = false }: any) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-xl transition-all duration-200 ${
      active
        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
        : "bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700/50"
    } ${className}`}
  >
    <Icon size={18} />
  </button>
);

export default function VoiceCenterDashboard() {
  const [activeTab, setActiveTab] = useState("active-calls");
  const [isDialerOpen, setIsDialerOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState("");
  const [callState, setCallState] = useState("idle"); // idle, calling, connected, hold
  const [callDuration, setCallDuration] = useState(0);

  // Dialer timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
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

  const TABS = [
    { id: "active-calls", label: "Active & Queue", icon: Layers },
    { id: "dialer", label: "WebRTC Dialer", icon: PhoneCall },
    { id: "ivr", label: "IVR Visual Builder", icon: GitMerge },
    { id: "transcription", label: "Live Transcriptions", icon: MessageSquare },
    { id: "agents", label: "Agent Performance", icon: Users },
    { id: "settings", label: "PBX Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-200 font-sans selection:bg-blue-500/30 flex flex-col">
      {/* HEADER */}
      <header className="h-16 border-b border-slate-800/60 bg-slate-900/50 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Headphones size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            SabDesk Voice Center
          </h1>
          <div className="h-4 w-[1px] bg-slate-700 mx-2"></div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              System Operational
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search calls, agents, numbers..."
              className="bg-slate-800/50 border border-slate-700/50 text-sm rounded-full pl-9 pr-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 w-64 transition-all"
            />
          </div>
          <IconButton icon={PhoneCall} onClick={() => setIsDialerOpen(!isDialerOpen)} active={isDialerOpen} />
          <IconButton icon={Settings} />
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 border border-slate-700 cursor-pointer"></div>
        </div>
      </header>

      {/* SUB-HEADER TABS */}
      <div className="px-6 border-b border-slate-800/60 bg-slate-900/30 overflow-x-auto flex no-scrollbar">
        <div className="flex gap-1 min-w-max py-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-hidden relative flex flex-col p-6 gap-6">
        {/* TAB CONTENT: ACTIVE CALLS */}
        {activeTab === "active-calls" && (
          <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {MOCK_QUEUE_STATS.map((stat) => (
                <div key={stat.id} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start">
                    <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{stat.label}</span>
                    <span className={`text-xs font-medium flex items-center gap-1 ${stat.trendUp ? "text-emerald-400" : "text-rose-400"}`}>
                      {stat.trendUp ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      {stat.trend}
                    </span>
                  </div>
                  <div className={`text-3xl font-bold ${stat.color} tracking-tight`}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* CALLS TABLE */}
            <div className="flex-1 bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="text-blue-400" size={18} />
                  Live Operations Center
                </h2>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600 transition-colors flex items-center gap-2">
                    <Filter size={14} /> Filter
                  </button>
                  <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 border border-blue-500 transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20">
                    <Download size={14} /> Export
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 sticky top-0 backdrop-blur-sm">
                    <tr>
                      <th className="px-6 py-4 font-medium">Caller</th>
                      <th className="px-6 py-4 font-medium">Number</th>
                      <th className="px-6 py-4 font-medium">Queue</th>
                      <th className="px-6 py-4 font-medium">Agent</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Duration</th>
                      <th className="px-6 py-4 font-medium">Sentiment</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {MOCK_ACTIVE_CALLS.map((call) => (
                      <tr key={call.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="px-6 py-4 font-medium text-slate-200 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                            {call.caller.charAt(0)}
                          </div>
                          {call.caller}
                        </td>
                        <td className="px-6 py-4 text-slate-400 font-mono text-xs">{call.number}</td>
                        <td className="px-6 py-4">
                          <Badge colorClass="border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
                            {call.queue}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {call.agent !== "Unassigned" ? (
                              <>
                                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
                                <span className="text-slate-300">{call.agent}</span>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                                <span className="text-amber-400/80 italic">Unassigned</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {call.status === "In Progress" && <span className="text-emerald-400 flex items-center gap-1.5"><PhoneCall size={14} /> {call.status}</span>}
                          {call.status === "In Queue" && <span className="text-amber-400 flex items-center gap-1.5"><Clock size={14} /> {call.status}</span>}
                          {call.status === "On Hold" && <span className="text-orange-400 flex items-center gap-1.5"><Pause size={14} /> {call.status}</span>}
                          {call.status === "Ringing" && <span className="text-blue-400 flex items-center gap-1.5"><PhoneIncoming size={14} className="animate-bounce" /> {call.status}</span>}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-300">{call.duration}</td>
                        <td className="px-6 py-4">
                          {call.sentiment === "Positive" && <span className="text-emerald-400">Positive</span>}
                          {call.sentiment === "Neutral" && <span className="text-slate-400">Neutral</span>}
                          {call.sentiment === "Negative" && <span className="text-rose-400 font-medium">Negative</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white" title="Listen In">
                              <Headphones size={16} />
                            </button>
                            <button className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-blue-400" title="Transfer">
                              <PhoneForwarded size={16} />
                            </button>
                            <button className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-rose-400" title="Drop Call">
                              <PhoneOff size={16} />
                            </button>
                            <button className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white">
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: WEBRTC DIALER */}
        {activeTab === "dialer" && (
          <div className="flex h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 items-center justify-center">
            <div className="w-[400px] h-[750px] bg-slate-900/80 border border-slate-700/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl relative">
              {/* Dialer Header */}
              <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-800/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                  <span className="text-sm font-medium text-slate-300">Agent Online</span>
                </div>
                <div className="flex gap-3 text-slate-400">
                  <SignalIcon strength={4} />
                  <Settings size={18} className="cursor-pointer hover:text-white transition-colors" />
                </div>
              </div>

              {/* Dialer Display */}
              <div className="flex flex-col items-center justify-center py-10 px-8 flex-shrink-0">
                <div className="text-sm text-slate-400 mb-2 font-medium tracking-wide uppercase">
                  {callState === "idle" ? "Enter Number" : callState === "calling" ? "Calling..." : "Connected"}
                </div>
                <input
                  type="text"
                  value={dialNumber}
                  readOnly
                  className="bg-transparent text-4xl font-light text-center text-white focus:outline-none w-full tracking-wider h-12"
                  placeholder="(555) 000-0000"
                />
                {callState === "connected" && (
                  <div className="mt-4 text-blue-400 font-mono text-lg bg-blue-500/10 px-4 py-1 rounded-full border border-blue-500/20">
                    {formatTime(callDuration)}
                  </div>
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
                <KeypadButton digit="1" letters="" onClick={() => setDialNumber(prev => prev + "1")} />
                <KeypadButton digit="2" letters="ABC" onClick={() => setDialNumber(prev => prev + "2")} />
                <KeypadButton digit="3" letters="DEF" onClick={() => setDialNumber(prev => prev + "3")} />
                <KeypadButton digit="4" letters="GHI" onClick={() => setDialNumber(prev => prev + "4")} />
                <KeypadButton digit="5" letters="JKL" onClick={() => setDialNumber(prev => prev + "5")} />
                <KeypadButton digit="6" letters="MNO" onClick={() => setDialNumber(prev => prev + "6")} />
                <KeypadButton digit="7" letters="PQRS" onClick={() => setDialNumber(prev => prev + "7")} />
                <KeypadButton digit="8" letters="TUV" onClick={() => setDialNumber(prev => prev + "8")} />
                <KeypadButton digit="9" letters="WXYZ" onClick={() => setDialNumber(prev => prev + "9")} />
                <KeypadButton digit="*" letters="" onClick={() => setDialNumber(prev => prev + "*")} />
                <KeypadButton digit="0" letters="+" onClick={() => setDialNumber(prev => prev + "0")} />
                <KeypadButton digit="#" letters="" onClick={() => setDialNumber(prev => prev + "#")} />
              </div>

              {/* Main Call Button */}
              <div className="p-8 flex justify-center gap-6 relative">
                {callState === "idle" ? (
                  <button 
                    onClick={handleDial}
                    className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all transform hover:scale-105 active:scale-95"
                  >
                    <Phone size={28} className="fill-current" />
                  </button>
                ) : (
                  <button 
                    onClick={handleHangup}
                    className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-400 flex items-center justify-center text-white shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all transform hover:scale-105 active:scale-95"
                  >
                    <PhoneOff size={28} className="fill-current" />
                  </button>
                )}
                
                {callState === "idle" && dialNumber.length > 0 && (
                  <button 
                    onClick={() => setDialNumber(prev => prev.slice(0, -1))}
                    className="absolute right-12 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
              </div>
            </div>
            
            {/* Context Panel for Dialer */}
            <div className="w-[450px] h-[750px] bg-slate-800/40 border border-slate-700/50 rounded-3xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 flex gap-4">
                <button className="flex-1 py-2 text-sm font-medium text-blue-400 border-b-2 border-blue-400">Recent</button>
                <button className="flex-1 py-2 text-sm font-medium text-slate-400 hover:text-slate-200">Contacts</button>
                <button className="flex-1 py-2 text-sm font-medium text-slate-400 hover:text-slate-200">Voicemail</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {[1,2,3,4,5,6,7,8,9,10].map(i => (
                  <div key={i} className="p-3 rounded-xl hover:bg-slate-700/30 flex items-center gap-4 cursor-pointer transition-colors border border-transparent hover:border-slate-700/50">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${i%3===0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      {i%3===0 ? <PhoneMissed size={18} /> : (i%2===0 ? <PhoneIncoming size={18} /> : <PhoneOutgoing size={18} />)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-200">{["John Smith", "Alice Cooper", "+1 (555) 987-6543", "Unknown"][i%4]}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        {i%3!==0 && <span>{Math.floor(Math.random()*10)}m {Math.floor(Math.random()*60)}s</span>}
                        <span>•</span>
                        <span>{i} hour{i>1?'s':''} ago</span>
                      </div>
                    </div>
                    <button className="text-slate-500 hover:text-blue-400 transition-colors p-2">
                      <PhoneCall size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: IVR VISUAL BUILDER */}
        {activeTab === "ivr" && (
          <div className="flex-1 flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full overflow-hidden">
            {/* Sidebar Tools */}
            <div className="w-64 bg-slate-800/40 border border-slate-700/50 rounded-xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 bg-slate-800/80">
                <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                  <Box size={16} className="text-blue-400" />
                  Nodes Palette
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2 px-1">Triggers</div>
                <IVRPaletteItem icon={PhoneIncoming} label="Incoming Call" color="emerald" />
                <IVRPaletteItem icon={Clock} label="Schedule" color="emerald" />
                
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4 px-1">Logic</div>
                <IVRPaletteItem icon={GitBranch} label="Condition" color="amber" />
                <IVRPaletteItem icon={List} label="Menu (IVR)" color="amber" />
                <IVRPaletteItem icon={Database} label="Data Lookup" color="amber" />
                
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-4 px-1">Actions</div>
                <IVRPaletteItem icon={Play} label="Play Audio" color="blue" />
                <IVRPaletteItem icon={Mic} label="Record Voicemail" color="blue" />
                <IVRPaletteItem icon={Users} label="Route to Queue" color="purple" />
                <IVRPaletteItem icon={PhoneForwarded} label="External Forward" color="purple" />
                <IVRPaletteItem icon={MessageSquare} label="Send SMS" color="purple" />
              </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 bg-slate-900 border border-slate-700/50 rounded-xl relative overflow-hidden flex flex-col">
              {/* Toolbar */}
              <div className="h-12 border-b border-slate-800 flex justify-between items-center px-4 bg-slate-800/30 absolute top-0 left-0 right-0 z-10 backdrop-blur-md">
                <div className="flex items-center gap-4 text-sm font-medium text-slate-300">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Main Support Flow
                  </span>
                  <span className="text-slate-500 text-xs px-2 py-1 bg-slate-800 rounded">v2.4 Draft</span>
                </div>
                <div className="flex gap-2">
                  <button className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"><Move size={16} /></button>
                  <button className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"><ZoomIn size={16} /></button>
                  <button className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"><ZoomOut size={16} /></button>
                  <div className="w-px h-6 bg-slate-700 mx-1"></div>
                  <button className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center gap-2 transition-colors">
                    <Save size={14} /> Publish Flow
                  </button>
                </div>
              </div>

              {/* Grid Background */}
              <div 
                className="absolute inset-0 z-0" 
                style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, rgba(51, 65, 85, 0.4) 1px, transparent 0)`,
                  backgroundSize: '24px 24px',
                  backgroundPosition: 'center center'
                }}
              />

              {/* Nodes rendering (Mocked layout) */}
              <div className="absolute inset-0 mt-12 z-0 overflow-auto flex items-center justify-center p-20">
                <div className="relative w-full max-w-4xl h-[600px] border border-slate-800/0">
                  {/* SVG for edges */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                    <path d="M 150 110 L 150 150 L 150 200" stroke="#475569" strokeWidth="2" fill="none" strokeDasharray="4 2" className="animate-pulse" />
                    <path d="M 150 260 L 150 300 L -50 300 L -50 350" stroke="#475569" strokeWidth="2" fill="none" />
                    <path d="M 150 260 L 150 300 L 350 300 L 350 350" stroke="#475569" strokeWidth="2" fill="none" />
                    <path d="M -50 410 L -50 450 L -50 500" stroke="#475569" strokeWidth="2" fill="none" />
                    <path d="M -50 560 L -50 600 L -200 600 L -200 650" stroke="#475569" strokeWidth="2" fill="none" />
                    <path d="M -50 560 L -50 600 L 100 600 L 100 650" stroke="#475569" strokeWidth="2" fill="none" />
                  </svg>
                  
                  {/* Nodes */}
                  {MOCK_IVR_NODES.map((node) => (
                    <div 
                      key={node.id} 
                      className={`absolute w-56 bg-slate-800/90 border border-slate-700 rounded-xl shadow-xl backdrop-blur-md transform -translate-x-1/2 -translate-y-1/2 cursor-move hover:border-blue-500/50 transition-colors z-10`}
                      style={{ left: `calc(50% + ${node.x}px)`, top: node.y }}
                    >
                      <div className="flex items-center gap-3 p-3 border-b border-slate-700/50">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          node.type === 'trigger' ? 'bg-emerald-500/20 text-emerald-400' :
                          node.type === 'menu' ? 'bg-amber-500/20 text-amber-400' :
                          node.type === 'route' || node.type === 'agent' ? 'bg-purple-500/20 text-purple-400' :
                          node.type === 'voicemail' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {node.type === 'trigger' && <PhoneIncoming size={16} />}
                          {node.type === 'menu' && <List size={16} />}
                          {node.type === 'route' && <ArrowRight size={16} />}
                          {node.type === 'agent' && <Users size={16} />}
                          {node.type === 'voicemail' && <Mic size={16} />}
                          {node.type === 'condition' && <GitBranch size={16} />}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-200">{node.title}</div>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-b-xl">
                        <div className="text-xs text-slate-400">{node.desc}</div>
                      </div>
                      
                      {/* Connection Points */}
                      {node.type !== 'trigger' && <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-700 border-2 border-slate-900 z-20"></div>}
                      {node.type !== 'voicemail' && node.type !== 'agent' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-900 z-20 cursor-crosshair"></div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Properties Panel */}
            <div className="w-80 bg-slate-800/40 border border-slate-700/50 rounded-xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 bg-slate-800/80 flex justify-between items-center">
                <h3 className="font-semibold text-slate-200">Properties</h3>
                <Settings size={16} className="text-slate-400" />
              </div>
              <div className="p-4 flex flex-col gap-4 overflow-y-auto">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300 flex gap-3">
                  <Info size={16} className="shrink-0 mt-0.5" />
                  Select a node on the canvas to edit its properties, routing logic, and media settings.
                </div>
                
                {/* Mock selected node properties */}
                <div className="space-y-4 opacity-50 pointer-events-none">
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1 block">Node Name</label>
                    <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300" value="Main Menu" readOnly />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1 block">Audio Prompt</label>
                    <div className="flex gap-2">
                      <select className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300" disabled>
                        <option>Text-to-Speech (Neural)</option>
                      </select>
                      <button className="bg-slate-700 p-2 rounded-lg text-slate-300"><Mic size={16} /></button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1 block">TTS Message</label>
                    <textarea className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 h-24" value="Welcome to SabDesk. Press 1 for Support, 2 for Sales, or stay on the line for an operator." readOnly />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-2 block">Key Presses</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                        <span className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center text-xs font-mono font-bold text-slate-300">1</span>
                        <ArrowRight size={14} className="text-slate-500" />
                        <span className="text-sm text-slate-300 flex-1 truncate">Route to Support</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                        <span className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center text-xs font-mono font-bold text-slate-300">2</span>
                        <ArrowRight size={14} className="text-slate-500" />
                        <span className="text-sm text-slate-300 flex-1 truncate">Route to Sales</span>
                      </div>
                      <button className="w-full py-1.5 border border-dashed border-slate-600 rounded-lg text-xs text-slate-400 flex items-center justify-center gap-1">
                        <Plus size={14} /> Add Option
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB CONTENT: LIVE TRANSCRIPTIONS */}
        {activeTab === "transcription" && (
          <div className="flex h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Active Calls List */}
            <div className="w-80 bg-slate-800/30 border border-slate-700/50 rounded-xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 bg-slate-800/50 flex justify-between items-center">
                <h3 className="font-semibold text-slate-200">Live AI Analysis</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              </div>
              <div className="p-3 border-b border-slate-700/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input type="text" placeholder="Search keywords..." className="w-full bg-slate-900/50 border border-slate-700/50 text-sm rounded-lg pl-9 pr-4 py-1.5 focus:outline-none" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {[1,2,3,4,5].map((i) => (
                  <div key={i} className={`p-3 rounded-lg cursor-pointer transition-colors ${i===1 ? 'bg-blue-600/20 border border-blue-500/30' : 'hover:bg-slate-800 border border-transparent'}`}>
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium text-slate-200 text-sm">{["Alice Johnson", "Bob Smith", "Corporate Inc", "VIP Client", "Unknown"][i-1]}</div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${i===1||i===4 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {i===1||i===4 ? 'Positive' : 'Frustrated'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center justify-between">
                      <span className="flex items-center gap-1"><Headphones size={12}/> Sarah C.</span>
                      <span className="font-mono">0{i}:24</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Transcription View */}
            <div className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-xl flex flex-col overflow-hidden relative">
              {/* Header */}
              <div className="h-16 border-b border-slate-700/50 bg-slate-800/40 flex justify-between items-center px-6">
                <div>
                  <h2 className="text-lg font-semibold text-white flex items-center gap-3">
                    Alice Johnson 
                    <Badge colorClass="border-blue-500/30 text-blue-400 bg-blue-500/10 text-[10px]">Support Queue</Badge>
                  </h2>
                  <div className="text-xs text-slate-400 flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1"><Clock size={12}/> Started 01:05 ago</span>
                    <span className="flex items-center gap-1"><MapPin size={12}/> New York, US</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                    <Zap size={16} className="text-amber-400" />
                    AI Suggestion
                  </button>
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20">
                    <UserPlus size={16} />
                    Barge In
                  </button>
                </div>
              </div>

              {/* Feed & Insights Layout */}
              <div className="flex-1 flex overflow-hidden">
                {/* Chat Feed */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
                  {MOCK_TRANSCRIPTION.map((msg) => (
                    <div key={msg.id} className={`flex gap-4 max-w-[85%] ${msg.speaker === "Agent" ? "ml-auto flex-row-reverse" : ""}`}>
                      <div className="flex-shrink-0 mt-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          msg.speaker === "Agent" ? "bg-blue-500 text-white" : "bg-slate-700 text-slate-300"
                        }`}>
                          {msg.speaker.charAt(0)}
                        </div>
                      </div>
                      <div className={`flex flex-col ${msg.speaker === "Agent" ? "items-end" : "items-start"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-400">{msg.speaker}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{msg.time}</span>
                        </div>
                        <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                          msg.speaker === "Agent" 
                            ? "bg-blue-600/90 text-white rounded-tr-sm shadow-md" 
                            : "bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm"
                        }`}>
                          {highlightKeywords(msg.text)}
                        </div>
                        {msg.sentiment === "Negative" && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-400 font-medium">
                            <AlertCircle size={10} /> Frustration detected
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-4 max-w-[85%] animate-pulse">
                     <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                          C
                        </div>
                      </div>
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-400">Customer</span>
                        </div>
                        <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm flex gap-1 items-center h-10">
                          <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                          <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                          <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                        </div>
                      </div>
                  </div>
                </div>

                {/* AI Insights Sidebar */}
                <div className="w-72 border-l border-slate-700/50 bg-slate-900/50 p-4 flex flex-col gap-6 overflow-y-auto">
                  
                  {/* Sentiment Gauge */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Overall Sentiment</h4>
                    <div className="flex flex-col items-center">
                      <div className="w-32 h-16 relative overflow-hidden flex items-end justify-center mb-2">
                        <div className="w-32 h-32 rounded-full border-[12px] border-slate-800 absolute top-0 border-b-transparent border-r-transparent rotate-45"></div>
                        <div className="w-32 h-32 rounded-full border-[12px] border-emerald-500 absolute top-0 border-b-transparent border-r-transparent rotate-45" style={{clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)'}}></div>
                        <div className="w-1 h-14 bg-slate-300 absolute bottom-0 origin-bottom rounded-full shadow-md z-10" style={{transform: 'rotate(30deg)'}}></div>
                        <div className="w-3 h-3 bg-slate-200 rounded-full absolute bottom-[-6px] z-20"></div>
                      </div>
                      <div className="text-lg font-bold text-emerald-400">Positive (78%)</div>
                    </div>
                  </div>

                  <div className="h-px bg-slate-800 w-full"></div>

                  {/* Smart Actions */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Zap size={14} className="text-amber-400" /> Suggested Actions
                    </h4>
                    <div className="space-y-2">
                      <button className="w-full text-left p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-blue-500/50 transition-colors group">
                        <div className="text-sm font-medium text-slate-200 mb-1 group-hover:text-blue-400">Send password reset guide</div>
                        <div className="text-xs text-slate-400">Matches: "trouble logging in", "reset password"</div>
                      </button>
                      <button className="w-full text-left p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-blue-500/50 transition-colors group">
                        <div className="text-sm font-medium text-slate-200 mb-1 group-hover:text-blue-400">Offer security review</div>
                        <div className="text-xs text-slate-400">Based on account lockout history</div>
                      </button>
                    </div>
                  </div>

                  <div className="h-px bg-slate-800 w-full"></div>

                  {/* Extracted Entities */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Extracted Data</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">EMAIL</div>
                        <div className="text-sm bg-slate-800 px-2 py-1 rounded border border-slate-700 font-mono text-blue-300 inline-block">customer@example.com</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">INTENT</div>
                        <div className="flex gap-1 flex-wrap">
                          <Badge colorClass="border-purple-500/30 text-purple-400 bg-purple-500/10">Login Issue</Badge>
                          <Badge colorClass="border-purple-500/30 text-purple-400 bg-purple-500/10">Account Locked</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* OTHER TABS (Placeholders for massive scale illusion) */}
        {(activeTab === "agents" || activeTab === "settings") && (
          <div className="flex-1 flex items-center justify-center text-slate-500 flex-col gap-4 animate-in fade-in zoom-in duration-500">
            <Cpu size={48} className="opacity-20" />
            <p>Module loading... Advanced {activeTab} analytics preparing.</p>
          </div>
        )}
      </main>

      {/* FOOTER / STATUS BAR */}
      <footer className="h-8 border-t border-slate-800/60 bg-slate-900/50 flex items-center justify-between px-4 text-[11px] text-slate-500 font-mono z-50">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5"><Globe size={12} /> region: us-east-1</span>
          <span className="flex items-center gap-1.5"><Server size={12} /> pbx: active (12ms)</span>
          <span className="flex items-center gap-1.5"><Shield size={12} /> e2ee: enabled</span>
        </div>
        <div className="flex gap-4">
          <span>SabDesk CallCenter OS v4.2.0</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  );
}

// Sub-components

const IVRPaletteItem = ({ icon: Icon, label, color }: { icon: any, label: string, color: string }) => (
  <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:bg-slate-800 hover:border-slate-600 cursor-grab flex items-center gap-3 transition-colors group">
    <div className={`text-${color}-400 bg-${color}-500/10 p-1.5 rounded-md`}>
      <Icon size={16} />
    </div>
    <span className="text-sm text-slate-300 group-hover:text-slate-100">{label}</span>
    <Move size={14} className="ml-auto text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
  </div>
);

const DialerAction = ({ icon: Icon, label }: { icon: any, label: string }) => (
  <button className="flex flex-col items-center gap-2 group">
    <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:bg-slate-700 group-hover:text-white transition-all group-active:scale-95">
      <Icon size={20} />
    </div>
    <span className="text-xs text-slate-400 font-medium group-hover:text-slate-300">{label}</span>
  </button>
);

const KeypadButton = ({ digit, letters, onClick }: { digit: string, letters: string, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="w-16 h-16 rounded-full flex flex-col items-center justify-center hover:bg-slate-800/80 active:bg-slate-700 transition-colors"
  >
    <span className="text-3xl font-light text-slate-200 leading-none mb-1">{digit}</span>
    <span className="text-[10px] font-bold text-slate-500 tracking-widest">{letters}</span>
  </button>
);

const SignalIcon = ({ strength }: { strength: number }) => (
  <div className="flex items-end gap-[2px] h-4">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className={`w-1 rounded-t-sm ${i <= strength ? 'bg-emerald-500' : 'bg-slate-700'}`} style={{ height: `${i * 25}%` }}></div>
    ))}
  </div>
);

// Helper for highlighting keywords in transcription
const highlightKeywords = (text: string) => {
  const keywords = ["invalid credentials", "reset my password", "customer@example.com", "locked"];
  let result = text;
  
  keywords.forEach(kw => {
    const regex = new RegExp(`(${kw})`, 'gi');
    // Using simple replacement for mock visual effect. In real app, would use split and map for React nodes to avoid dangerouslySetInnerHTML
  });
  
  // Simple react-safe render with bolding for demo
  const parts = text.split(/(invalid credentials|reset my password|customer@example.com|locked)/gi);
  return (
    <>
      {parts.map((part, i) => 
        keywords.includes(part.toLowerCase()) 
          ? <span key={i} className="bg-yellow-500/20 text-yellow-200 px-1 rounded font-medium">{part}</span> 
          : part
      )}
    </>
  );
};

// Icons needed but not imported directly from top (Mocked as functional components to prevent errors if missing from Lucide)
const MapPin = ({ size, className }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>;
const ZoomIn = ({ size, className }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>;
const ZoomOut = ({ size, className }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>;
