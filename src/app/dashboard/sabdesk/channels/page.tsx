"use client";

import React, { useState, useMemo } from "react";
import {
  MessageCircle,
  Mail,
  Facebook,
  Instagram,
  Twitter,
  Phone,
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  MoreVertical,
  RefreshCw,
  Power,
  Settings,
  Link as LinkIcon,
  Zap,
  Activity,
  Users,
  Shield,
  Globe,
  Smartphone,
  Bell,
  Lock,
  Key,
  Cpu,
  Database,
  Cloud,
  Star,
} from "lucide-react";

// Massive Mock Data for Channels
const initialChannels = Array.from({ length: 50 }).map((_, i) => ({
  id: `channel-${i}`,
  name:
    [
      "WhatsApp Business",
      "Support Email",
      "Facebook Page",
      "Instagram DM",
      "Twitter Handle",
      "SMS Gateway",
      "Live Chat",
      "Telegram Bot",
    ][i % 8] + ` ${i + 1}`,
  type: [
    "whatsapp",
    "email",
    "facebook",
    "instagram",
    "twitter",
    "sms",
    "chat",
    "telegram",
  ][i % 8],
  status: i % 3 === 0 ? "disconnected" : "connected",
  messagesToday: Math.floor(Math.random() * 5000),
  lastSync: new Date(Date.now() - Math.random() * 10000000).toISOString(),
  health: Math.floor(Math.random() * 100),
  apiKey: `sk_live_${Math.random().toString(36).substring(2, 15)}`,
  webhookUrl: `https://api.sabdesk.com/webhook/ch_${i}`,
  autoReply: i % 2 === 0,
  agentRouting: i % 4 !== 0,
  tags: ["support", "sales", "marketing", "billing"].slice(0, (i % 3) + 1),
}));

export default function ChannelsPage() {
  const [channels, setChannels] = useState(initialChannels);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const filteredChannels = useMemo(() => {
    return channels.filter((c) => {
      if (activeTab !== "all" && c.type !== activeTab) return false;
      if (
        searchTerm &&
        !c.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;
      return true;
    });
  }, [channels, searchTerm, activeTab]);

  const toggleStatus = (id: string) => {
    setChannels(
      channels.map((c) =>
        c.id === id
          ? {
              ...c,
              status: c.status === "connected" ? "disconnected" : "connected",
            }
          : c,
      ),
    );
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "whatsapp":
        return <MessageCircle className="w-6 h-6 text-green-500" />;
      case "email":
        return <Mail className="w-6 h-6 text-blue-500" />;
      case "facebook":
        return <Facebook className="w-6 h-6 text-blue-600" />;
      case "instagram":
        return <Instagram className="w-6 h-6 text-pink-500" />;
      case "twitter":
        return <Twitter className="w-6 h-6 text-sky-500" />;
      case "sms":
        return <Phone className="w-6 h-6 text-gray-500" />;
      case "chat":
        return <MessageSquare className="w-6 h-6 text-purple-500" />;
      case "telegram":
        return <Zap className="w-6 h-6 text-blue-400" />;
      default:
        return <LinkIcon className="w-6 h-6 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Channel Integrations
            </h1>
            <p className="text-neutral-400 mt-1">
              Manage all your communication channels in one unified interface.
              100+ supported integrations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors">
              <RefreshCw className="w-4 h-4" />
              <span>Sync All</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
              <Plus className="w-4 h-4" />
              <span>Add Channel</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Channels",
              value: channels.length,
              icon: Globe,
              color: "text-blue-400",
            },
            {
              label: "Active Connections",
              value: channels.filter((c) => c.status === "connected").length,
              icon: Activity,
              color: "text-green-400",
            },
            {
              label: "Messages Today",
              value: channels
                .reduce((acc, c) => acc + c.messagesToday, 0)
                .toLocaleString(),
              icon: MessageCircle,
              color: "text-purple-400",
            },
            {
              label: "Avg Health Score",
              value:
                Math.round(
                  channels.reduce((acc, c) => acc + c.health, 0) /
                    channels.length,
                ) + "%",
              icon: Shield,
              color: "text-amber-400",
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex items-center gap-4 hover:border-neutral-700 transition-colors"
            >
              <div className={`p-3 bg-neutral-800 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-neutral-400 text-sm">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Filters */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="relative mb-6">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search channels..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-neutral-200 placeholder-neutral-500"
                />
              </div>

              <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                Categories
              </h3>
              <div className="space-y-1">
                {[
                  "all",
                  "whatsapp",
                  "email",
                  "facebook",
                  "instagram",
                  "twitter",
                  "sms",
                  "chat",
                  "telegram",
                ].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveTab(cat)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm capitalize transition-colors ${activeTab === cat ? "bg-blue-500/10 text-blue-400 font-medium" : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"}`}
                  >
                    {cat === "all" ? "All Channels" : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 border border-blue-500/20 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Cloud className="w-24 h-24" />
              </div>
              <h3 className="font-semibold text-white mb-2">
                Need Custom Webhooks?
              </h3>
              <p className="text-sm text-blue-200/70 mb-4">
                Integrate your own internal tools using our flexible webhook
                system.
              </p>
              <button className="text-sm bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors w-full border border-white/10">
                Read Documentation
              </button>
            </div>
          </div>

          {/* List & Details View */}
          <div className="lg:col-span-3 space-y-4">
            {selectedChannel ? (
              // Detailed Channel Settings Panel (Massive Configuration)
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                {(() => {
                  const ch = channels.find((c) => c.id === selectedChannel);
                  if (!ch) return null;
                  return (
                    <div>
                      <div className="border-b border-neutral-800 p-6 flex items-start justify-between bg-neutral-900/50">
                        <div className="flex items-center gap-4">
                          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 shadow-inner">
                            {getIcon(ch.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h2 className="text-2xl font-bold">{ch.name}</h2>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${ch.status === "connected" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}
                              >
                                {ch.status.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-neutral-400 text-sm mt-1">
                              ID: {ch.id} • Type:{" "}
                              <span className="capitalize">{ch.type}</span>
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedChannel(null)}
                          className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
                        >
                          <XCircle className="w-5 h-5 text-neutral-400" />
                        </button>
                      </div>

                      <div className="p-6 space-y-8 h-[600px] overflow-y-auto custom-scrollbar">
                        {/* Section: API & Connection */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-neutral-800 pb-2">
                            <Key className="w-5 h-5 text-blue-400" /> Connection
                            Details
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
                                API Key
                              </label>
                              <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2">
                                <Lock className="w-4 h-4 text-neutral-500" />
                                <input
                                  type="password"
                                  value={ch.apiKey}
                                  readOnly
                                  className="bg-transparent border-none outline-none w-full text-sm text-neutral-300 font-mono"
                                />
                                <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                                  Reveal
                                </button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
                                Webhook URL
                              </label>
                              <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2">
                                <LinkIcon className="w-4 h-4 text-neutral-500" />
                                <input
                                  type="text"
                                  value={ch.webhookUrl}
                                  readOnly
                                  className="bg-transparent border-none outline-none w-full text-sm text-neutral-300 font-mono"
                                />
                                <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                                  Copy
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Section: Routing Rules (Massive settings mock) */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-neutral-800 pb-2">
                            <Cpu className="w-5 h-5 text-purple-400" />{" "}
                            Automated Routing & Logic
                          </h3>
                          <div className="space-y-3">
                            {[
                              {
                                title: "Smart Agent Routing",
                                desc: "Automatically assign conversations to agents based on workload and skill.",
                                state: ch.agentRouting,
                              },
                              {
                                title: "Auto-Reply on New Threads",
                                desc: "Send a customizable greeting when a customer initiates a new conversation.",
                                state: ch.autoReply,
                              },
                              {
                                title: "Spam Filtering (AI)",
                                desc: "Use AI to detect and automatically archive spam or abusive messages.",
                                state: true,
                              },
                              {
                                title: "Sentiment Analysis",
                                desc: "Analyze customer sentiment and flag negative conversations for priority handling.",
                                state: false,
                              },
                              {
                                title: "Language Detection",
                                desc: "Automatically route based on detected language.",
                                state: true,
                              },
                              {
                                title: "SLA Timers",
                                desc: "Start SLA countdowns immediately upon message receipt.",
                                state: true,
                              },
                              {
                                title: "After-Hours Auto-Responder",
                                desc: "Reply with business hours when outside of schedule.",
                                state: false,
                              },
                              {
                                title: "CSAT Survey Trigger",
                                desc: "Send customer satisfaction survey upon conversation resolution.",
                                state: true,
                              },
                            ].map((toggle, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between p-4 bg-neutral-950/50 border border-neutral-800/50 rounded-lg hover:border-neutral-700 transition-colors"
                              >
                                <div>
                                  <h4 className="text-sm font-medium text-neutral-200">
                                    {toggle.title}
                                  </h4>
                                  <p className="text-xs text-neutral-500 mt-0.5">
                                    {toggle.desc}
                                  </p>
                                </div>
                                <button
                                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none ${toggle.state ? "bg-blue-600" : "bg-neutral-700"}`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${toggle.state ? "translate-x-2" : "-translate-x-2"}`}
                                  />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Section: Data Retention */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-neutral-800 pb-2">
                            <Database className="w-5 h-5 text-emerald-400" />{" "}
                            Data & Privacy
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="text-sm font-medium text-neutral-300 block mb-2">
                                Message Retention Period
                              </label>
                              <select className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:border-blue-500 focus:outline-none">
                                <option>30 Days</option>
                                <option>90 Days</option>
                                <option>1 Year</option>
                                <option>Forever (Requires Enterprise)</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-neutral-300 block mb-2">
                                PII Masking
                              </label>
                              <select className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:border-blue-500 focus:outline-none">
                                <option>Disabled</option>
                                <option>Mask Emails & Phones</option>
                                <option>
                                  Strict (Credit Cards, SSN, etc.)
                                </option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="mt-8 pt-6 border-t border-red-900/30">
                          <h3 className="text-red-400 font-semibold mb-2">
                            Danger Zone
                          </h3>
                          <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-lg flex items-center justify-between">
                            <div>
                              <h4 className="text-sm font-medium text-neutral-200">
                                Delete Channel
                              </h4>
                              <p className="text-xs text-neutral-500 mt-1">
                                Permanently remove this channel and all its
                                routing rules. Message history will be retained
                                according to policy.
                              </p>
                            </div>
                            <button className="px-4 py-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-600/20 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                              Delete Channel
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              // Channel List
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredChannels.length === 0 ? (
                  <div className="col-span-full py-12 text-center border border-dashed border-neutral-800 rounded-xl">
                    <div className="w-16 h-16 mx-auto bg-neutral-900 rounded-full flex items-center justify-center mb-4">
                      <Search className="w-8 h-8 text-neutral-600" />
                    </div>
                    <h3 className="text-lg font-medium text-neutral-300">
                      No channels found
                    </h3>
                    <p className="text-neutral-500 mt-1">
                      Try adjusting your search or filters.
                    </p>
                  </div>
                ) : (
                  filteredChannels.map((channel) => (
                    <div
                      key={channel.id}
                      className="group bg-neutral-900 border border-neutral-800 rounded-xl p-5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer relative overflow-hidden"
                      onClick={() => setSelectedChannel(channel.id)}
                    >
                      <div
                        className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-transparent ${channel.status === "connected" ? "to-green-500/5" : "to-red-500/5"} rounded-bl-full pointer-events-none`}
                      />

                      <div className="flex items-start justify-between mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-neutral-950 rounded-lg border border-neutral-800">
                            {getIcon(channel.type)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-neutral-200 group-hover:text-blue-400 transition-colors">
                              {channel.name}
                            </h3>
                            <p className="text-xs text-neutral-500 capitalize">
                              {channel.type} Integration
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatus(channel.id);
                            }
                            className={`p-1.5 rounded-md transition-colors ${channel.status === "connected" ? "text-green-500 hover:bg-green-500/10" : "text-red-500 hover:bg-red-500/10"}`}
                            title={
                              channel.status === "connected"
                                ? "Disconnect"
                                : "Connect"
                            }
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-neutral-950/50 rounded-lg p-2.5 border border-neutral-800/50">
                          <p className="text-xs text-neutral-500 mb-1 flex items-center gap-1">
                            <Activity className="w-3 h-3" /> Messages
                          </p>
                          <p className="font-mono text-sm">
                            {channel.messagesToday.toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-neutral-950/50 rounded-lg p-2.5 border border-neutral-800/50">
                          <p className="text-xs text-neutral-500 mb-1 flex items-center gap-1">
                            <Shield className="w-3 h-3" /> Health
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${channel.health > 80 ? "bg-green-500" : channel.health > 50 ? "bg-amber-500" : "bg-red-500"}`}
                                style={ width: `${channel.health}%` }
                              />
                            </div>
                            <span className="font-mono text-xs">
                              {channel.health}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {channel.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-neutral-800 text-neutral-400 text-[10px] uppercase tracking-wider rounded border border-neutral-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
