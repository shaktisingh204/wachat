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
  Search,
  RefreshCw,
  Power,
  Link as LinkIcon,
  Zap,
  Activity,
  Shield,
  Globe,
  Key,
  Lock,
  Cpu,
  Database,
  Cloud,
  X,
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
  Field,
  Input,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from "@/components/sabcrm/20ui";

// Realistic mock data for channels.
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

const CATEGORIES = [
  "all",
  "whatsapp",
  "email",
  "facebook",
  "instagram",
  "twitter",
  "sms",
  "chat",
  "telegram",
];

const ROUTING_TOGGLES = [
  {
    title: "Smart Agent Routing",
    desc: "Automatically assign conversations to agents based on workload and skill.",
    key: "agentRouting" as const,
  },
  {
    title: "Auto-Reply on New Threads",
    desc: "Send a customizable greeting when a customer initiates a new conversation.",
    key: "autoReply" as const,
  },
  {
    title: "Spam Filtering (AI)",
    desc: "Use AI to detect and automatically archive spam or abusive messages.",
    defaultOn: true,
  },
  {
    title: "Sentiment Analysis",
    desc: "Analyze customer sentiment and flag negative conversations for priority handling.",
    defaultOn: false,
  },
  {
    title: "Language Detection",
    desc: "Automatically route based on detected language.",
    defaultOn: true,
  },
  {
    title: "SLA Timers",
    desc: "Start SLA countdowns immediately upon message receipt.",
    defaultOn: true,
  },
  {
    title: "After-Hours Auto-Responder",
    desc: "Reply with business hours when outside of schedule.",
    defaultOn: false,
  },
  {
    title: "CSAT Survey Trigger",
    desc: "Send customer satisfaction survey upon conversation resolution.",
    defaultOn: true,
  },
];

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
        return <MessageCircle className="w-6 h-6 text-green-500" aria-hidden="true" />;
      case "email":
        return <Mail className="w-6 h-6 text-blue-500" aria-hidden="true" />;
      case "facebook":
        return <Facebook className="w-6 h-6 text-blue-600" aria-hidden="true" />;
      case "instagram":
        return <Instagram className="w-6 h-6 text-pink-500" aria-hidden="true" />;
      case "twitter":
        return <Twitter className="w-6 h-6 text-sky-500" aria-hidden="true" />;
      case "sms":
        return <Phone className="w-6 h-6 text-[var(--st-text-secondary)]" aria-hidden="true" />;
      case "chat":
        return <MessageSquare className="w-6 h-6 text-purple-500" aria-hidden="true" />;
      case "telegram":
        return <Zap className="w-6 h-6 text-blue-400" aria-hidden="true" />;
      default:
        return <LinkIcon className="w-6 h-6 text-[var(--st-text-tertiary)]" aria-hidden="true" />;
    }
  };

  const totalChannels = channels.length;
  const activeConnections = channels.filter(
    (c) => c.status === "connected",
  ).length;
  const messagesToday = channels
    .reduce((acc, c) => acc + c.messagesToday, 0)
    .toLocaleString();
  const avgHealth =
    Math.round(
      channels.reduce((acc, c) => acc + c.health, 0) / channels.length,
    ) + "%";

  return (
    <div className="20ui dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Channel Integrations</PageTitle>
            <PageDescription>
              Manage all your communication channels in one unified interface.
              100+ supported integrations.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="secondary" iconLeft={RefreshCw}>
              Sync All
            </Button>
            <Button variant="primary" iconLeft={Plus}>
              Add Channel
            </Button>
          </PageActions>
        </PageHeader>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Channels"
            value={totalChannels}
            icon={Globe}
            accent="var(--st-accent)"
          />
          <StatCard
            label="Active Connections"
            value={activeConnections}
            icon={Activity}
            accent="var(--st-status-ok)"
          />
          <StatCard
            label="Messages Today"
            value={messagesToday}
            icon={MessageCircle}
            accent="var(--st-accent)"
          />
          <StatCard
            label="Avg Health Score"
            value={avgHealth}
            icon={Shield}
            accent="var(--st-warn)"
          />
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Filters */}
          <div className="lg:col-span-1 space-y-6">
            <Card padding="md">
              <div className="mb-6">
                <Input
                  type="text"
                  placeholder="Search channels..."
                  aria-label="Search channels"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  iconLeft={Search}
                />
              </div>

              <h2 className="text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider mb-3">
                Categories
              </h2>
              <div className="space-y-1">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat}
                    variant={activeTab === cat ? "primary" : "ghost"}
                    block
                    className="justify-start capitalize"
                    onClick={() => setActiveTab(cat)}
                  >
                    {cat === "all" ? "All Channels" : cat}
                  </Button>
                ))}
              </div>
            </Card>

            <Card padding="lg" className="relative overflow-hidden">
              <Cloud
                className="absolute top-0 right-0 m-4 w-24 h-24 opacity-10 text-[var(--st-accent)]"
                aria-hidden="true"
              />
              <CardTitle className="mb-2">Need Custom Webhooks?</CardTitle>
              <p className="text-sm text-[var(--st-text-secondary)] mb-4">
                Integrate your own internal tools using our flexible webhook
                system.
              </p>
              <Button variant="outline" block>
                Read Documentation
              </Button>
            </Card>
          </div>

          {/* List & Details View */}
          <div className="lg:col-span-3 space-y-4">
            {selectedChannel ? (
              // Detailed Channel Settings Panel.
              (() => {
                const ch = channels.find((c) => c.id === selectedChannel);
                if (!ch) return null;
                return (
                  <Card
                    padding="none"
                    className="overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300"
                  >
                    <CardHeader className="flex items-start justify-between gap-4 border-b border-[var(--st-border)] p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-4 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius-lg)] border border-[var(--st-border)]">
                          {getIcon(ch.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-[var(--st-text)]">
                              {ch.name}
                            </h2>
                            <Badge
                              tone={
                                ch.status === "connected" ? "success" : "danger"
                              }
                            >
                              {ch.status.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-[var(--st-text-secondary)] text-sm mt-1">
                            ID: {ch.id}, Type:{" "}
                            <span className="capitalize">{ch.type}</span>
                          </p>
                        </div>
                      </div>
                      <IconButton
                        label="Close channel settings"
                        icon={X}
                        onClick={() => setSelectedChannel(null)}
                      />
                    </CardHeader>

                    <CardBody className="p-6 space-y-8 h-[600px] overflow-y-auto">
                      {/* Section: API & Connection */}
                      <section className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-[var(--st-border)] pb-2 text-[var(--st-text)]">
                          <Key
                            className="w-5 h-5 text-[var(--st-accent)]"
                            aria-hidden="true"
                          />{" "}
                          Connection Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Field label="API Key">
                            <Input
                              type="password"
                              value={ch.apiKey}
                              readOnly
                              iconLeft={Lock}
                              className="font-mono"
                            />
                          </Field>
                          <Field label="Webhook URL">
                            <Input
                              type="text"
                              value={ch.webhookUrl}
                              readOnly
                              iconLeft={LinkIcon}
                              className="font-mono"
                            />
                          </Field>
                        </div>
                      </section>

                      {/* Section: Routing Rules */}
                      <section className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-[var(--st-border)] pb-2 text-[var(--st-text)]">
                          <Cpu
                            className="w-5 h-5 text-purple-400"
                            aria-hidden="true"
                          />{" "}
                          Automated Routing & Logic
                        </h3>
                        <div className="space-y-3">
                          {ROUTING_TOGGLES.map((toggle, i) => {
                            const initialOn =
                              "key" in toggle
                                ? Boolean(ch[toggle.key])
                                : Boolean(toggle.defaultOn);
                            return (
                              <div
                                key={i}
                                className="flex items-center justify-between gap-4 p-4 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)]"
                              >
                                <div>
                                  <h4 className="text-sm font-medium text-[var(--st-text)]">
                                    {toggle.title}
                                  </h4>
                                  <p className="text-xs text-[var(--st-text-tertiary)] mt-0.5">
                                    {toggle.desc}
                                  </p>
                                </div>
                                <Switch
                                  defaultChecked={initialOn}
                                  aria-label={toggle.title}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </section>

                      {/* Section: Data Retention */}
                      <section className="space-y-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-[var(--st-border)] pb-2 text-[var(--st-text)]">
                          <Database
                            className="w-5 h-5 text-emerald-400"
                            aria-hidden="true"
                          />{" "}
                          Data & Privacy
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Field label="Message Retention Period">
                            <Select defaultValue="30d">
                              <SelectTrigger aria-label="Message Retention Period">
                                <SelectValue placeholder="Select a period" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="30d">30 Days</SelectItem>
                                <SelectItem value="90d">90 Days</SelectItem>
                                <SelectItem value="1y">1 Year</SelectItem>
                                <SelectItem value="forever">
                                  Forever (Requires Enterprise)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="PII Masking">
                            <Select defaultValue="disabled">
                              <SelectTrigger aria-label="PII Masking">
                                <SelectValue placeholder="Select a level" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="disabled">
                                  Disabled
                                </SelectItem>
                                <SelectItem value="basic">
                                  Mask Emails & Phones
                                </SelectItem>
                                <SelectItem value="strict">
                                  Strict (Credit Cards, SSN, etc.)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>
                      </section>

                      {/* Danger Zone */}
                      <section className="pt-6 border-t border-[var(--st-border)]">
                        <h3 className="text-[var(--st-danger)] font-semibold mb-2">
                          Danger Zone
                        </h3>
                        <div className="p-4 bg-[var(--st-danger-soft)] border border-[var(--st-danger)] rounded-[var(--st-radius)] flex items-center justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-[var(--st-text)]">
                              Delete Channel
                            </h4>
                            <p className="text-xs text-[var(--st-text-tertiary)] mt-1">
                              Permanently remove this channel and all its routing
                              rules. Message history will be retained according to
                              policy.
                            </p>
                          </div>
                          <Button variant="danger" className="whitespace-nowrap">
                            Delete Channel
                          </Button>
                        </div>
                      </section>
                    </CardBody>
                  </Card>
                );
              })()
            ) : (
              // Channel List
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredChannels.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState
                      icon={Search}
                      title="No channels found"
                      description="Try adjusting your search or filters."
                    />
                  </div>
                ) : (
                  filteredChannels.map((channel) => (
                    <Card
                      key={channel.id}
                      variant="interactive"
                      padding="md"
                      role="button"
                      tabIndex={0}
                      className="group relative overflow-hidden cursor-pointer"
                      onClick={() => setSelectedChannel(channel.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedChannel(channel.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)]">
                            {getIcon(channel.type)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-[var(--st-text)]">
                              {channel.name}
                            </h3>
                            <p className="text-xs text-[var(--st-text-tertiary)] capitalize">
                              {channel.type} Integration
                            </p>
                          </div>
                        </div>
                        <IconButton
                          label={
                            channel.status === "connected"
                              ? "Disconnect channel"
                              : "Connect channel"
                          }
                          icon={Power}
                          variant={
                            channel.status === "connected"
                              ? "secondary"
                              : "danger"
                          }
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStatus(channel.id);
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] p-2.5 border border-[var(--st-border)]">
                          <p className="text-xs text-[var(--st-text-tertiary)] mb-1 flex items-center gap-1">
                            <Activity className="w-3 h-3" aria-hidden="true" />{" "}
                            Messages
                          </p>
                          <p className="font-mono text-sm text-[var(--st-text)]">
                            {channel.messagesToday.toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] p-2.5 border border-[var(--st-border)]">
                          <p className="text-xs text-[var(--st-text-tertiary)] mb-1 flex items-center gap-1">
                            <Shield className="w-3 h-3" aria-hidden="true" />{" "}
                            Health
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-[var(--st-bg-muted)] rounded-[var(--st-radius-pill)] overflow-hidden">
                              <div
                                className={`h-full rounded-[var(--st-radius-pill)] ${channel.health > 80 ? "bg-[var(--st-status-ok)]" : channel.health > 50 ? "bg-[var(--st-warn)]" : "bg-[var(--st-danger)]"}`}
                                style={{ width: `${channel.health}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs text-[var(--st-text)]">
                              {channel.health}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {channel.tags.map((tag) => (
                          <Badge key={tag} tone="neutral" kind="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </Card>
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
