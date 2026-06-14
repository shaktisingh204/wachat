"use client";

/**
 * Per-app sidebar registry.
 *
 * Maps pathname prefixes to grouped sidebar menu configs. SabHomeShell
 * consults this when no explicit `sidebarGroups` prop is passed — so as
 * the user navigates between apps, the sidebar swaps to the menu set for
 * the currently active app.
 *
 * Every href in this file has been verified against the real
 * `src/app/.../page.tsx` files — there should be no 404s. Top-level
 * routes are exhaustive; deep-link sub-routes (e.g. /broadcasts/[id])
 * are reached from their parent list page.
 */

import type { ComponentType, SVGProps } from "react";
import {
  Activity,
  AlertTriangle,
  Bug,
  Columns3,
  GanttChart,
  LayoutGrid,
  Archive,
  ArrowDown,
  AtSign,
  BadgeCheck,
  BarChart3,
  Bell,
  BellOff,
  Bookmark,
  BookOpen,
  Braces,
  Briefcase,
  Brush,
  Building,
  Building2,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock,
  Code2,
  Coins,
  Compass,
  Contact,
  CreditCard,
  Database,
  DollarSign,
  Eye,
  FileImage,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Files,
  Filter,
  Flag,
  Folder,
  FolderOpen,
  HardDrive,
  Gauge,
  GitBranch,
  Globe,
  Headphones,
  Heart,
  HeartPulse,
  History,
  Home,
  Image as ImageIcon,
  Inbox,
  Key,
  Kanban,
  Layers,
  Lightbulb,
  Link as LinkIcon,
  Link2,
  ListChecks,
  LogOut,
  Mail,
  Map as MapIcon,
  MapPin,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MessagesSquare,
  Mic,
  Network,
  Package,
  PackageCheck,
  Palette,
  Paperclip,
  Pause,
  Percent,
  Phone,
  PhoneCall,
  PhoneOff,
  PieChart,
  Pin,
  Play,
  Plug,
  Plus,
  PlusCircle,
  Puzzle,
  QrCode,
  Receipt,
  Repeat,
  RotateCw,
  Search,
  Send,
  Server,
  ServerCog,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  SquareSlash,
  Star,
  Tag,
  Tags,
  Target,
  Ticket,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
  Truck,
  Upload,
  User,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
  Video,
  Wallet,
  Wand2,
  Webhook,
  Workflow,
  WrenchIcon,
  Zap,
} from "lucide-react";

import type { SabSidebarGroup } from "./app-sidebar";
import { MODULE_SIDEBARS } from "./module-sidebars";

export interface SabAppSidebarConfig {
  prefix: string;
  heading: string;
  caption?: string;
  build: (pathname: string) => SabSidebarGroup[];
}

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

function leaf(
  id: string,
  label: string,
  href: string,
  IconComp: Icon,
  pathname: string,
  options?: { exact?: boolean; adminOnly?: boolean },
) {
  return {
    id,
    label,
    href,
    icon: <IconComp />,
    active:
      pathname === href ||
      (!options?.exact && href !== "/" && pathname.startsWith(href + "/")),
    ...(options?.adminOnly ? { adminOnly: true as const } : {}),
  };
}

/* ────────────────────────────────────────────────────────────────────
 * Per-app menus.  Order matters — deeper-prefixed apps must come BEFORE
 * the catch-all `/dashboard`.
 * ────────────────────────────────────────────────────────────────── */

export const SAB_APP_SIDEBARS: SabAppSidebarConfig[] = [
  /* ─────────────────────────────  WaChat  ─────────────────────────── */
  {
    prefix: "/wachat",
    heading: "WaChat",
    caption: "WhatsApp workspace",
    build: (p) => [
      {
        id: "wa-inbox",
        label: "Inbox",
        items: [
          leaf("overview", "Overview", "/wachat/overview", Home, p),
          leaf("chat", "Chat", "/wachat/chat", MessageSquare, p),
          leaf("kanban", "Conversation kanban", "/wachat/conversation-kanban", Kanban, p),
          leaf("filters", "Conversation filters", "/wachat/conversation-filters", Filter, p),
          leaf("search", "Conversation search", "/wachat/conversation-search", Search, p),
          leaf("summary", "Conversation summary", "/wachat/conversation-summary", FileText, p),
          leaf("transfer", "Transfer", "/wachat/chat-transfer", Share2, p),
          leaf("ratings", "Ratings", "/wachat/chat-ratings", Star, p),
          leaf("export", "Export chat", "/wachat/chat-export", FileSpreadsheet, p),
          leaf("labels", "Labels", "/wachat/chat-labels", Tag, p),
        ],
      },
      {
        id: "wa-contacts",
        label: "Contacts",
        items: [
          leaf("contacts", "All contacts", "/wachat/contacts", Users, p),
          leaf("groups", "Groups", "/wachat/contact-groups", Users, p),
          leaf("merge", "Merge", "/wachat/contact-merge", UserCheck, p),
          leaf("notes", "Notes", "/wachat/contact-notes", FileText, p),
          leaf("timeline", "Timeline", "/wachat/contact-timeline", History, p),
          leaf("blacklist", "Blacklist", "/wachat/contact-blacklist", UserMinus, p),
          leaf("blocked", "Blocked", "/wachat/blocked-contacts", UserMinus, p),
          leaf("import", "Import history", "/wachat/contact-import-history", Files, p),
        ],
      },
      {
        id: "wa-broadcast",
        label: "Broadcasts",
        items: [
          leaf("broadcasts", "Broadcasts", "/wachat/broadcasts", Megaphone, p),
          leaf("history", "History", "/wachat/broadcast-history", History, p),
          leaf("scheduler", "Scheduler", "/wachat/broadcast-scheduler", Calendar, p),
          leaf("segments", "Segments", "/wachat/broadcast-segments", Layers, p),
          leaf("ab-test", "A/B test", "/wachat/campaign-ab-test", Filter, p),
          leaf("scheduled", "Scheduled messages", "/wachat/scheduled-messages", Clock, p),
          leaf("bulk", "Bulk send", "/wachat/bulk", Send, p),
          leaf("bulk-msg", "Bulk messaging", "/wachat/bulk-messaging", Send, p),
          leaf("opt-out", "Opt-out", "/wachat/opt-out", BellOff, p),
        ],
      },
      {
        id: "wa-templates",
        label: "Templates",
        items: [
          leaf("templates", "Templates", "/wachat/templates", FileText, p),
          leaf("template-create", "Create template", "/wachat/templates/create", Plus, p),
          leaf("template-library", "Library", "/wachat/templates/library", BookOpen, p),
          leaf("template-builder", "Template builder", "/wachat/template-builder", WrenchIcon, p),
          leaf("template-analytics", "Template analytics", "/wachat/template-analytics", BarChart3, p),
          leaf("templates-library", "Messages library", "/wachat/message-templates-library", BookOpen, p),
          leaf("interactive", "Interactive messages", "/wachat/templates/interactive-message-builder", Sparkles, p),
        ],
      },
      {
        id: "wa-flows",
        label: "Flows & automation",
        items: [
          leaf("flows", "Meta Flows", "/wachat/flows", GitBranch, p),
          leaf("flows-create", "Create flow", "/wachat/flows/create", Plus, p),
          leaf("flow-builder", "Flow builder", "/wachat/flow-builder", Workflow, p),
          leaf("automation", "Automation", "/wachat/automation", Zap, p),
          leaf("chatbot", "Chatbot", "/wachat/chatbot", MessageCircle, p),
          leaf("auto-reply", "Auto-reply", "/wachat/auto-reply", Repeat, p),
          leaf("auto-reply-rules", "Auto-reply rules", "/wachat/auto-reply-rules", Filter, p),
          leaf("greetings", "Greetings", "/wachat/greeting-messages", MessageSquare, p),
          leaf("away", "Away messages", "/wachat/away-messages", PhoneOff, p),
          leaf("assignments", "Assignments", "/wachat/assignments", UserCheck, p),
        ],
      },
      {
        id: "wa-quick",
        label: "Quick replies & saved",
        items: [
          leaf("saved-replies", "Saved replies", "/wachat/saved-replies", Bookmark, p),
          leaf("canned", "Canned messages", "/wachat/canned-messages", BookOpen, p),
          leaf("quick-cats", "Quick reply cats", "/wachat/quick-reply-categories", Tags, p),
          leaf("tags", "Message tags", "/wachat/message-tags", Tag, p),
        ],
      },
      {
        id: "wa-calls",
        label: "Calls",
        items: [
          leaf("calls", "Call logs", "/wachat/calls/logs", PhoneCall, p),
          leaf("call-settings", "Call settings", "/wachat/calls/settings", Settings, p),
        ],
      },
      {
        id: "wa-commerce",
        label: "Commerce",
        items: [
          leaf("catalog", "Catalog", "/wachat/catalog", ShoppingBag, p),
          leaf("catalog-new", "New product", "/wachat/catalog/new", Plus, p),
          leaf("pay", "WhatsApp Pay", "/wachat/whatsapp-pay", CreditCard, p),
          leaf("pay-settings", "Pay settings", "/wachat/whatsapp-pay/settings", Settings, p),
          leaf("ads", "WhatsApp ads", "/wachat/whatsapp-ads", Megaphone, p),
          leaf("ads-setup", "Ads setup", "/wachat/whatsapp-ads/setup", Sparkles, p),
        ],
      },
      {
        id: "wa-team",
        label: "Team",
        items: [
          leaf("availability", "Agent availability", "/wachat/agent-availability", UserCheck, p),
          leaf("performance", "Team performance", "/wachat/team-performance", TrendingUp, p),
          leaf("response", "Response times", "/wachat/response-time-tracker", Timer, p),
          leaf("csat", "Customer satisfaction", "/wachat/customer-satisfaction", Heart, p),
          leaf("hours", "Business hours", "/wachat/business-hours", Clock, p),
        ],
      },
      {
        id: "wa-tools",
        label: "Tools",
        items: [
          leaf("link-tracking", "Link tracking", "/wachat/link-tracking", LinkIcon, p),
          leaf("link-gen", "Link generator", "/wachat/whatsapp-link-generator", Link2, p),
          leaf("post-gen", "Post generator", "/wachat/post-generator", Wand2, p),
          leaf("qr-codes", "QR codes", "/wachat/qr-codes", QrCode, p),
          leaf("media", "Media library", "/wachat/media-library", Files, p),
          leaf("two-line", "Two-line", "/wachat/two-line", Layers, p),
        ],
      },
      {
        id: "wa-analytics",
        label: "Analytics",
        items: [
          leaf("analytics", "Analytics", "/wachat/analytics", BarChart3, p),
          leaf("delivery", "Delivery reports", "/wachat/delivery-reports", CheckCheck, p),
          leaf("msg-analytics", "Message analytics", "/wachat/message-analytics", PieChart, p),
          leaf("msg-stats", "Message stats", "/wachat/message-statistics", BarChart3, p),
          leaf("health", "Account health", "/wachat/health", Activity, p),
        ],
      },
      {
        id: "wa-numbers",
        label: "Numbers & dev",
        items: [
          leaf("numbers", "Numbers", "/wachat/numbers", Phone, p),
          leaf("phone-settings", "Phone settings", "/wachat/phone-number-settings", Settings, p),
          leaf("webhooks", "Webhooks", "/wachat/webhooks", Webhook, p),
          leaf("webhook-logs", "Webhook logs", "/wachat/webhook-logs", FileSearch, p),
        ],
      },
      {
        id: "wa-settings",
        label: "Settings",
        items: [
          leaf("agents", "Agents & roles", "/wachat/settings/agents", UserCog, p),
          leaf("attributes", "Attributes", "/wachat/settings/attributes", Layers, p),
          leaf("canned-set", "Canned messages", "/wachat/settings/canned", BookOpen, p),
          leaf("general", "General", "/wachat/settings/general", Settings, p),
          leaf("integrations", "Integrations", "/wachat/integrations", Puzzle, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  Meta Suite  ─────────────────────── */
  {
    prefix: "/dashboard/facebook",
    heading: "Meta Suite",
    caption: "Facebook & Instagram pages",
    build: (p) => [
      {
        id: "meta-account",
        label: "Account",
        items: [
          leaf("home", "Overview", "/dashboard/facebook", Home, p),
          leaf("all-projects", "All projects", "/dashboard/facebook/all-projects", Briefcase, p),
          leaf("all-projects2", "Projects (alt)", "/dashboard/facebook/all/projects", Briefcase, p),
          leaf("pages", "Pages", "/dashboard/facebook/pages", Files, p),
          leaf("setup", "Setup", "/dashboard/facebook/setup", Sparkles, p),
          leaf("settings", "Page settings", "/dashboard/facebook/settings", Settings, p),
          leaf("page-roles", "Page roles", "/dashboard/facebook/page-roles", UserCog, p),
          leaf("messenger", "Messenger settings", "/dashboard/facebook/messenger-settings", MessageCircle, p),
          leaf("agents", "Agents", "/dashboard/facebook/agents", UserCheck, p),
        ],
      },
      {
        id: "meta-content",
        label: "Content",
        items: [
          leaf("posts", "Posts", "/dashboard/facebook/posts", FileText, p),
          leaf("create-post", "Create post", "/dashboard/facebook/create-post", PlusCircle, p),
          leaf("scheduled", "Scheduled", "/dashboard/facebook/scheduled", Clock, p),
          leaf("calendar", "Calendar", "/dashboard/facebook/calendar", Calendar, p),
          leaf("reels", "Reels", "/dashboard/facebook/reels", Video, p),
          leaf("stories", "Stories", "/dashboard/facebook/stories", ImageIcon, p),
          leaf("live", "Live studio", "/dashboard/facebook/live-studio", Mic, p),
          leaf("media", "Media", "/dashboard/facebook/media", Files, p),
          leaf("kanban", "Kanban", "/dashboard/facebook/kanban", Kanban, p),
          leaf("randomizer", "Post randomizer", "/dashboard/facebook/post-randomizer", Sparkles, p),
          leaf("bulk-create", "Bulk create", "/dashboard/facebook/bulk-create", Layers, p),
        ],
      },
      {
        id: "meta-engage",
        label: "Engagement",
        items: [
          leaf("messages", "Messages", "/dashboard/facebook/messages", MessageSquare, p),
          leaf("auto-reply", "Auto-reply", "/dashboard/facebook/auto-reply", Repeat, p),
          leaf("moderation", "Moderation", "/dashboard/facebook/moderation", Shield, p),
          leaf("audience", "Audience", "/dashboard/facebook/audience", Users, p),
          leaf("subscribers", "Subscribers", "/dashboard/facebook/subscribers", BadgeCheck, p),
          leaf("visitors", "Visitor posts", "/dashboard/facebook/visitor-posts", User, p),
          leaf("reviews", "Reviews", "/dashboard/facebook/reviews", Star, p),
        ],
      },
      {
        id: "meta-marketing",
        label: "Marketing",
        items: [
          leaf("broadcasts", "Broadcasts", "/dashboard/facebook/broadcasts", Megaphone, p),
          leaf("leads", "Leads", "/dashboard/facebook/leads", Target, p),
          leaf("competitors", "Competitors", "/dashboard/facebook/competitors", Eye, p),
          leaf("events", "Events", "/dashboard/facebook/events", Calendar, p),
          leaf("knowledge", "Knowledge", "/dashboard/facebook/knowledge", BookOpen, p),
        ],
      },
      {
        id: "meta-flows",
        label: "Automation",
        items: [
          leaf("flow-builder", "Flow builder", "/dashboard/facebook/flow-builder", Workflow, p),
          leaf("flow-docs", "Flow docs", "/dashboard/facebook/flow-builder/docs", BookOpen, p),
          leaf("webhooks", "Webhooks", "/dashboard/facebook/webhooks", Webhook, p),
        ],
      },
      {
        id: "meta-commerce",
        label: "Commerce",
        items: [
          leaf("ecomm", "Custom e-commerce", "/dashboard/facebook/custom-ecommerce", ShoppingCart, p),
          leaf("ecomm-dash", "E-comm dashboard", "/dashboard/facebook/custom-ecommerce/dashboard", Home, p),
          leaf("ecomm-appearance", "Appearance", "/dashboard/facebook/custom-ecommerce/appearance", Palette, p),
          leaf("shop", "Shop", "/dashboard/facebook/commerce/shop", ShoppingBag, p),
          leaf("products", "Products", "/dashboard/facebook/commerce/products", Package, p),
          leaf("collections", "Collections", "/dashboard/facebook/commerce/collections", Layers, p),
          leaf("orders", "Orders", "/dashboard/facebook/commerce/orders", ShoppingCart, p),
          leaf("commerce-analytics", "Commerce analytics", "/dashboard/facebook/commerce/analytics", BarChart3, p),
          leaf("commerce-api", "Commerce API", "/dashboard/facebook/commerce/api", Code2, p),
        ],
      },
      {
        id: "meta-insights",
        label: "Insights",
        items: [
          leaf("insights", "Insights", "/dashboard/facebook/insights", BarChart3, p),
          leaf("roadmap", "Roadmap", "/dashboard/facebook/roadmap", MapIcon, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  Ad Manager  ─────────────────────── */
  {
    prefix: "/dashboard/ad-manager",
    heading: "Ad Manager",
    caption: "Campaigns, ad sets & ads",
    build: (p) => [
      {
        id: "ad-overview",
        label: "Overview",
        items: [
          leaf("home", "Home", "/dashboard/ad-manager", Home, p),
          leaf("accounts", "Ad accounts", "/dashboard/ad-manager/ad-accounts", CreditCard, p),
          leaf("calendar", "Calendar", "/dashboard/ad-manager/calendar", Calendar, p),
          leaf("billing", "Billing", "/dashboard/ad-manager/billing", DollarSign, p),
        ],
      },
      {
        id: "ad-build",
        label: "Build",
        items: [
          leaf("create", "Create campaign", "/dashboard/ad-manager/create", PlusCircle, p),
          leaf("campaigns", "Campaigns", "/dashboard/ad-manager/campaigns", Megaphone, p),
          leaf("adsets", "Ad sets", "/dashboard/ad-manager/ad-sets", Layers, p),
          leaf("ads", "Ads", "/dashboard/ad-manager/ads", FileImage, p),
          leaf("previews", "Ad previews", "/dashboard/ad-manager/ad-previews", Eye, p),
          leaf("creative", "Creative library", "/dashboard/ad-manager/creative-library", Files, p),
          leaf("bulk-editor", "Bulk editor", "/dashboard/ad-manager/bulk-editor", Layers, p),
          leaf("split-tests", "Split tests", "/dashboard/ad-manager/split-tests", GitBranch, p),
          leaf("compare", "Compare", "/dashboard/ad-manager/compare", Filter, p),
        ],
      },
      {
        id: "ad-audiences",
        label: "Audiences",
        items: [
          leaf("audiences", "Audiences", "/dashboard/ad-manager/audiences", Users, p),
          leaf("customer-lists", "Customer lists", "/dashboard/ad-manager/customer-lists", ClipboardList, p),
          leaf("lead-forms", "Lead forms", "/dashboard/ad-manager/lead-forms", FileText, p),
          leaf("catalogs", "Catalogs", "/dashboard/ad-manager/catalogs", ShoppingBag, p),
        ],
      },
      {
        id: "ad-tracking",
        label: "Tracking",
        items: [
          leaf("pixels", "Pixels", "/dashboard/ad-manager/pixels", Target, p),
          leaf("capi", "Conversions API", "/dashboard/ad-manager/capi", Plug, p),
          leaf("custom-conv", "Custom conversions", "/dashboard/ad-manager/custom-conversions", Filter, p),
          leaf("events", "Events manager", "/dashboard/ad-manager/events-manager", Activity, p),
          leaf("funnel", "Conversion funnel", "/dashboard/ad-manager/conversion-funnel", PieChart, p),
        ],
      },
      {
        id: "ad-optimize",
        label: "Optimize",
        items: [
          leaf("ai-lab", "AI lab", "/dashboard/ad-manager/ai-lab", Sparkles, p),
          leaf("auto-rules", "Automated rules", "/dashboard/ad-manager/automated-rules", Workflow, p),
          leaf("budget", "Budget optimizer", "/dashboard/ad-manager/budget-optimizer", DollarSign, p),
        ],
      },
      {
        id: "ad-measure",
        label: "Measure",
        items: [
          leaf("reports", "Reports", "/dashboard/ad-manager/reports", BarChart3, p),
          leaf("insights", "Insights", "/dashboard/ad-manager/insights", PieChart, p),
        ],
      },
      {
        id: "ad-config",
        label: "Settings",
        items: [
          leaf("settings", "Settings", "/dashboard/ad-manager/settings", Settings, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  SabFlow  ────────────────────────── */
  {
    prefix: "/dashboard/sabflow",
    heading: "SabFlow",
    caption: "Visual flow builder",
    build: (p) => [
      {
        id: "sabflow-main",
        label: "Workspace",
        items: [
          leaf("overview", "Overview", "/dashboard/sabflow", Home, p, { exact: true }),
          leaf("home", "All flows", "/dashboard/sabflow/flow-builder", Workflow, p),
          leaf("folders", "Folders", "/dashboard/sabflow/folders", Folder, p),
          leaf("marketplace", "Marketplace", "/dashboard/sabflow/marketplace", ShoppingBag, p),
          leaf("import", "Import", "/dashboard/sabflow/import", Upload, p),
        ],
      },
      {
        id: "sabflow-runs",
        label: "Runs",
        items: [
          leaf("executions", "Executions", "/dashboard/sabflow/executions", Play, p),
          leaf("logs", "Logs", "/dashboard/sabflow/logs", FileSearch, p),
          leaf("links", "Links", "/dashboard/sabflow/links", Link2, p),
          leaf("health", "Health", "/dashboard/sabflow/health", HeartPulse, p),
        ],
      },
      {
        id: "sabflow-access",
        label: "Access",
        items: [
          leaf("connections", "Connections", "/dashboard/sabflow/connections", Plug, p),
          leaf("api-keys", "API keys", "/dashboard/sabflow/api-keys", Key, p),
          leaf("env-vars", "Env vars", "/dashboard/sabflow/env-vars", Braces, p),
          leaf("workspaces", "Workspaces", "/dashboard/sabflow/workspaces", Building2, p),
          leaf("invites", "Invites", "/dashboard/sabflow/invites", Mail, p),
        ],
      },
      {
        id: "sabflow-insights",
        label: "Insights",
        items: [
          leaf("usage", "Usage", "/dashboard/sabflow/usage", Gauge, p),
          leaf("audit", "Audit log", "/dashboard/sabflow/audit", ShieldCheck, p),
        ],
      },
      {
        id: "sabflow-resources",
        label: "Resources",
        items: [
          leaf("docs", "Docs", "/dashboard/sabflow/docs", BookOpen, p),
          leaf("settings", "Settings", "/dashboard/sabflow/settings", Settings, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  SabChat  ────────────────────────── */
  {
    prefix: "/dashboard/sabchat",
    heading: "SabChat",
    caption: "Multi-agent inbox",
    build: (p) => [
      {
        id: "sabchat-inbox",
        label: "Inbox",
        items: [
          leaf("inbox", "Conversations", "/dashboard/sabchat/inbox", Inbox, p),
          leaf("visitors", "Visitors", "/dashboard/sabchat/visitors", Users, p),
          leaf("auto-reply", "Auto-reply", "/dashboard/sabchat/auto-reply", Repeat, p),
          leaf("ai-replies", "AI replies", "/dashboard/sabchat/ai-replies", Sparkles, p),
          leaf("quick-replies", "Quick replies", "/dashboard/sabchat/quick-replies", Bookmark, p),
          leaf("faq", "FAQ", "/dashboard/sabchat/faq", BookOpen, p),
        ],
      },
      {
        id: "sabchat-deploy",
        label: "Deploy",
        items: [
          leaf("widget", "Widget", "/dashboard/sabchat/widget", Code2, p),
          leaf("analytics", "Analytics", "/dashboard/sabchat/analytics", BarChart3, p),
          leaf("settings", "Settings", "/dashboard/sabchat/settings", Settings, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  Telegram  ───────────────────────── */
  {
    prefix: "/dashboard/telegram",
    heading: "Telegram",
    caption: "Telegram bots & broadcasts",
    build: (p) => [
      {
        id: "tg-account",
        label: "Workspace",
        items: [
          leaf("projects", "Workspaces", "/dashboard/telegram/projects", FolderOpen, p),
          leaf("home", "Overview", "/dashboard/telegram", Home, p),
          leaf("connections", "Connections", "/dashboard/telegram/connections", LinkIcon, p),
          leaf("bots", "Bots", "/dashboard/telegram/bots", ServerCog, p),
          leaf("api", "API credentials", "/dashboard/telegram/api-credentials", Key, p),
          leaf("settings", "Settings", "/dashboard/telegram/settings", Settings, p),
        ],
      },
      {
        id: "tg-content",
        label: "Content",
        items: [
          leaf("chat", "Chat", "/dashboard/telegram/chat", MessageSquare, p),
          leaf("inbox", "Business inbox", "/dashboard/telegram/business-inbox", Inbox, p),
          leaf("broadcasts", "Broadcasts", "/dashboard/telegram/broadcasts", Megaphone, p),
          leaf("channels", "Channels", "/dashboard/telegram/channels", Server, p),
          leaf("contacts", "Contacts", "/dashboard/telegram/contacts", Users, p),
          leaf("stories", "Stories", "/dashboard/telegram/stories", ImageIcon, p),
          leaf("stickers", "Stickers", "/dashboard/telegram/stickers", Sparkles, p),
        ],
      },
      {
        id: "tg-automation",
        label: "Automation",
        items: [
          leaf("flows", "Flows", "/dashboard/telegram/flows", GitBranch, p),
          leaf("commands", "Commands", "/dashboard/telegram/commands", SquareSlash, p),
          leaf("auto-reply", "Auto-reply", "/dashboard/telegram/auto-reply", Repeat, p),
          leaf("webhooks", "Webhooks", "/dashboard/telegram/webhooks", Webhook, p),
        ],
      },
      {
        id: "tg-monetize",
        label: "Monetize",
        items: [
          leaf("ads", "Ads", "/dashboard/telegram/ads", Megaphone, p),
          leaf("payments", "Payments", "/dashboard/telegram/payments", CreditCard, p),
          leaf("apps", "Mini apps", "/dashboard/telegram/mini-apps", Sparkles, p),
          leaf("analytics", "Analytics", "/dashboard/telegram/analytics", BarChart3, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  Instagram  ──────────────────────── */
  {
    prefix: "/dashboard/instagram",
    heading: "Instagram",
    caption: "IG content & messaging",
    build: (p) => [
      {
        id: "ig-account",
        label: "Account",
        items: [
          leaf("home", "Home", "/dashboard/instagram", Home, p),
          leaf("connections", "Connections", "/dashboard/instagram/connections", LinkIcon, p),
          leaf("setup", "Setup", "/dashboard/instagram/setup", Sparkles, p),
          leaf("setup-docs", "Setup docs", "/dashboard/instagram/setup/docs", BookOpen, p),
        ],
      },
      {
        id: "ig-content",
        label: "Content",
        items: [
          leaf("feed", "Feed", "/dashboard/instagram/feed", Layers, p),
          leaf("reels", "Reels", "/dashboard/instagram/reels", Video, p),
          leaf("stories", "Stories", "/dashboard/instagram/stories", ImageIcon, p),
          leaf("create", "Create post", "/dashboard/instagram/create-post", PlusCircle, p),
        ],
      },
      {
        id: "ig-discover",
        label: "Discovery",
        items: [
          leaf("discovery", "Discovery", "/dashboard/instagram/discovery", Compass, p),
          leaf("hashtag", "Hashtag search", "/dashboard/instagram/hashtag-search", Filter, p),
          leaf("messages", "Messages", "/dashboard/instagram/messages", MessageCircle, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  HRM  ──────────────────────────────
   *
   * Two top-level pillars:
   *   HR (People Ops)  → /dashboard/hrm/hr/**
   *   Payroll          → /dashboard/hrm/payroll/**
   *
   * Plus overview entries. List pages only — detail/edit/new flows
   * are launched from their list page.
   */
  {
    prefix: "/dashboard/hrm",
    heading: "HR Manager",
    caption: "People ops & payroll",
    build: (p) => [
      /* ─── Overview ─── */
      {
        id: "hrm-overview",
        label: "Overview",
        items: [
          leaf("home", "Home", "/dashboard/hrm", Home, p, { exact: true }),
          leaf("hr-home", "HR overview", "/dashboard/hrm/hr", Users, p, { exact: true }),
          leaf("payroll-home", "Payroll overview", "/dashboard/hrm/payroll", Wallet, p, { exact: true }),
        ],
      },

      /* ─── HR · Directory & Org ─── */
      {
        id: "hrm-people",
        label: "HR · People",
        items: [
          leaf("directory", "Directory", "/dashboard/hrm/hr/directory", UserCheck, p),
          leaf("org-chart", "Org chart", "/dashboard/hrm/hr/org-chart", Network, p),
          leaf("careers", "Careers page", "/dashboard/hrm/hr/careers-page", Globe, p),
        ],
      },

      /* ─── HR · Recruitment ─── */
      {
        id: "hrm-recruit",
        label: "HR · Recruitment",
        items: [
          leaf("jobs", "Jobs", "/dashboard/hrm/hr/jobs", Briefcase, p),
          leaf("candidates", "Candidates", "/dashboard/hrm/hr/candidates", Search, p),
          leaf("interviews", "Interviews", "/dashboard/hrm/hr/interviews", Users, p),
          leaf("offers", "Offers", "/dashboard/hrm/hr/offers", FileText, p),
        ],
      },

      /* ─── HR · Onboarding ─── */
      {
        id: "hrm-onboarding",
        label: "HR · Onboarding",
        items: [
          leaf("onboarding", "Onboarding", "/dashboard/hrm/hr/onboarding", UserPlus, p),
          leaf("probation", "Probation", "/dashboard/hrm/hr/probation", Flag, p),
          leaf("welcome-kit", "Welcome kit", "/dashboard/hrm/hr/welcome-kit", Heart, p),
        ],
      },

      /* ─── HR · Performance ─── */
      {
        id: "hrm-perf",
        label: "HR · Performance",
        items: [
          leaf("okrs", "Goals / OKRs", "/dashboard/hrm/hr/okrs", Target, p),
          leaf("feedback", "360° feedback", "/dashboard/hrm/hr/feedback-360", MessagesSquare, p),
          leaf("one-on-ones", "One-on-ones", "/dashboard/hrm/hr/one-on-ones", MessageCircle, p),
          leaf("recognition", "Recognition", "/dashboard/hrm/hr/recognition", Star, p),
          leaf("surveys", "Surveys", "/dashboard/hrm/hr/surveys", ClipboardList, p),
        ],
      },

      /* ─── HR · Learning ─── */
      {
        id: "hrm-learning",
        label: "HR · Learning",
        items: [
          leaf("training", "Training", "/dashboard/hrm/hr/training", BookOpen, p),
          leaf("certifications", "Certifications", "/dashboard/hrm/hr/certifications", BadgeCheck, p),
          leaf("learning-paths", "Learning paths", "/dashboard/hrm/hr/learning-paths", MapIcon, p),
        ],
      },

      /* ─── HR · Docs & Assets ─── */
      {
        id: "hrm-docs",
        label: "HR · Docs & Assets",
        items: [
          leaf("documents", "Documents", "/dashboard/hrm/hr/documents", Files, p),
          leaf("doc-templates", "Doc templates", "/dashboard/hrm/hr/document-templates", FileSpreadsheet, p),
          leaf("policies", "Policies", "/dashboard/hrm/hr/policies", FileText, p),
          leaf("assets", "Assets", "/dashboard/hrm/hr/assets", Package, p),
          leaf("asset-assign", "Asset assignments", "/dashboard/hrm/hr/asset-assignments", ClipboardList, p),
        ],
      },

      /* ─── HR · Time & Expenses ─── */
      {
        id: "hrm-time",
        label: "HR · Time & Expenses",
        items: [
          leaf("timesheets", "Timesheets", "/dashboard/hrm/hr/timesheets", Timer, p),
          leaf("travel", "Travel", "/dashboard/hrm/hr/travel", Globe, p),
          leaf("expense-claims", "Expense claims", "/dashboard/hrm/hr/expense-claims", Receipt, p),
        ],
      },

      /* ─── HR · Exit & Compensation ─── */
      {
        id: "hrm-exit",
        label: "HR · Exit & Comp",
        items: [
          leaf("exits", "Exits", "/dashboard/hrm/hr/exits", LogOut, p),
          leaf("succession", "Succession", "/dashboard/hrm/hr/succession", TrendingUp, p),
          leaf("comp-bands", "Compensation bands", "/dashboard/hrm/hr/compensation-bands", Coins, p),
          leaf("announcements", "Announcements", "/dashboard/hrm/hr/announcements", Megaphone, p),
        ],
      },

      /* ─── HR · Recognition & Awards ─── */
      {
        id: "hrm-recognition",
        label: "HR · Recognition",
        items: [
          leaf("awards", "Awards", "/dashboard/hrm/hr/awards", Trophy, p),
          leaf("disciplinary", "Disciplinary cases", "/dashboard/hrm/hr/disciplinary", AlertTriangle, p),
        ],
      },

      /* ─── Payroll · Employees ─── */
      {
        id: "payroll-employees",
        label: "Payroll · Employees",
        items: [
          leaf("pr-emp", "Directory", "/dashboard/hrm/payroll/employees", Users, p, { exact: true }),
          leaf("pr-emp-new", "Add employee", "/dashboard/hrm/payroll/employees/new", UserPlus, p),
          leaf("pr-emp-docs", "Documents", "/dashboard/hrm/payroll/employees/documents", Files, p),
          leaf("pr-emp-ec", "Emergency contacts", "/dashboard/hrm/payroll/employees/emergency-contacts", Phone, p),
          leaf("pr-emp-skills", "Employee skills", "/dashboard/hrm/payroll/employees/employee-skills", Sparkles, p),
          leaf("pr-emp-skills2", "Skills", "/dashboard/hrm/payroll/employees/skills", Sparkles, p),
          leaf("pr-emp-visa", "Visa details", "/dashboard/hrm/payroll/employees/visa-details", BadgeCheck, p),
          leaf("pr-emp-leave-q", "Leave quotas", "/dashboard/hrm/payroll/employees/leave-quotas", Calendar, p),
          leaf("pr-emp-teams", "Teams", "/dashboard/hrm/payroll/employees/teams", Users, p),
          leaf("pr-emp-profile", "Profile", "/dashboard/hrm/payroll/employees/profile", User, p),
        ],
      },

      /* ─── Payroll · Departments & Designations ─── */
      {
        id: "payroll-org",
        label: "Payroll · Org",
        items: [
          leaf("departments", "Departments", "/dashboard/hrm/payroll/departments", Building, p, { exact: true }),
          leaf("dept-hier", "Departments hierarchy", "/dashboard/hrm/payroll/departments/hierarchy", Network, p),
          leaf("designations", "Designations", "/dashboard/hrm/payroll/designations", Briefcase, p, { exact: true }),
          leaf("desig-hier", "Designations hierarchy", "/dashboard/hrm/payroll/designations/hierarchy", Network, p),
        ],
      },

      /* ─── Payroll · Attendance & Leave ─── */
      {
        id: "payroll-attendance",
        label: "Payroll · Attendance",
        items: [
          leaf("attendance", "Attendance", "/dashboard/hrm/payroll/attendance", UserCheck, p),
          leaf("holidays", "Holidays", "/dashboard/hrm/payroll/holidays", Calendar, p),
          leaf("leave", "Leave", "/dashboard/hrm/payroll/leave", Calendar, p, { exact: true }),
          leaf("leave-types", "Leave types", "/dashboard/hrm/payroll/leave/types", Tags, p),
          leaf("leave-balance", "Leave balance", "/dashboard/hrm/payroll/leave/balance", PieChart, p),
          leaf("leave-calendar", "Leave calendar", "/dashboard/hrm/payroll/leave/calendar", Calendar, p),
          leaf("leave-settings", "Leave settings", "/dashboard/hrm/payroll/leave/settings", Settings, p),
        ],
      },

      /* ─── Payroll · Shifts ─── */
      {
        id: "payroll-shifts",
        label: "Payroll · Shifts",
        items: [
          leaf("shifts", "Shifts", "/dashboard/hrm/payroll/shifts", Clock, p, { exact: true }),
          leaf("shifts-schedule", "Shifts schedule", "/dashboard/hrm/payroll/shifts/schedule", Calendar, p),
          leaf("shift-rot", "Shift rotations", "/dashboard/hrm/payroll/shift-rotations", RotateCw, p, { exact: true }),
          leaf("shift-rot-auto", "Rotation automate", "/dashboard/hrm/payroll/shift-rotations/automate", Workflow, p),
          leaf("shift-change", "Shift change requests", "/dashboard/hrm/payroll/shift-change-requests", Repeat, p),
        ],
      },

      /* ─── Payroll · Salary & Compliance ─── */
      {
        id: "payroll-salary",
        label: "Payroll · Salary",
        items: [
          leaf("salary-struct", "Salary structure", "/dashboard/hrm/payroll/salary-structure", DollarSign, p),
          leaf("payroll-run", "Payroll run", "/dashboard/hrm/payroll/payroll", Wallet, p),
          leaf("payslips", "Payslips", "/dashboard/hrm/payroll/payslips", Receipt, p),
          leaf("pf-esi", "PF & ESI", "/dashboard/hrm/payroll/pf-esi", ShieldCheck, p),
          leaf("ptax", "Professional tax", "/dashboard/hrm/payroll/professional-tax", Percent, p),
          leaf("tds", "TDS", "/dashboard/hrm/payroll/tds", Percent, p),
          leaf("form-16", "Form 16", "/dashboard/hrm/payroll/form-16", FileText, p),
        ],
      },

      /* ─── Payroll · Performance ─── */
      {
        id: "payroll-perf",
        label: "Payroll · Performance",
        items: [
          leaf("goal-setting", "Goal setting", "/dashboard/hrm/payroll/goal-setting", Target, p),
          leaf("kpi", "KPI tracking", "/dashboard/hrm/payroll/kpi-tracking", Gauge, p),
          leaf("appraisals", "Appraisal reviews", "/dashboard/hrm/payroll/appraisal-reviews", Star, p),
        ],
      },

      /* ─── Payroll · Time tracking ─── */
      {
        id: "payroll-time",
        label: "Payroll · Time",
        items: [
          leaf("time-logs", "Time logs", "/dashboard/hrm/payroll/time-logs", Timer, p),
          leaf("weekly-ts", "Weekly timesheets", "/dashboard/hrm/payroll/weekly-timesheets", Calendar, p),
        ],
      },

      /* ─── Payroll · Reports ─── */
      {
        id: "payroll-reports",
        label: "Payroll · Reports",
        items: [
          leaf("reports", "Reports", "/dashboard/hrm/payroll/reports", BarChart3, p, { exact: true }),
          leaf("rep-attendance", "Attendance", "/dashboard/hrm/payroll/reports/attendance", UserCheck, p),
          leaf("rep-leave", "Leave", "/dashboard/hrm/payroll/reports/leave", Calendar, p),
          leaf("rep-payroll", "Payroll summary", "/dashboard/hrm/payroll/reports/payroll-summary", PieChart, p),
          leaf("rep-salary", "Salary register", "/dashboard/hrm/payroll/reports/salary-register", FileSpreadsheet, p),
        ],
      },

      /* ─── Payroll · Settings ─── */
      {
        id: "payroll-settings",
        label: "Payroll · Settings",
        items: [
          leaf("pr-settings", "Settings", "/dashboard/hrm/payroll/settings", Settings, p),
        ],
      },

      /* ─── Employee Portal ─── */
      {
        id: "hrm-portal",
        label: "Employee Portal",
        items: [
          leaf("portal-home", "My Portal", "/dashboard/hrm/portal", Users, p, { exact: true }),
          leaf("portal-roadmaps", "Roadmaps", "/dashboard/hrm/portal/roadmaps", MapIcon, p, { exact: true }),
          leaf("portal-new-roadmap", "New roadmap", "/dashboard/hrm/portal/roadmaps/new", Plus, p),
          leaf("portal-reports", "Task reports", "/dashboard/hrm/portal/reports", ClipboardList, p),
        ],
      },

      /* ─── HRM Admin ─── */
      {
        id: "hrm-admin",
        label: "HRM · Admin",
        items: [
          leaf("perm-groups", "Permission groups", "/dashboard/hrm/permission-groups", ShieldCheck, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  SEO Suite  ──────────────────────── */
  {
    prefix: "/dashboard/seo",
    heading: "SEO Suite",
    caption: "Site audits, tools & rankings",
    build: (p) => [
      {
        id: "seo-overview",
        label: "Overview",
        items: [
          leaf("home", "Home", "/dashboard/seo", Home, p, { exact: true }),
          leaf("brand-radar", "Brand radar", "/dashboard/seo/brand-radar", Compass, p),
          leaf("site-explorer", "Site explorer", "/dashboard/seo/site-explorer", Search, p),
          leaf("experts", "Experts", "/dashboard/seo/experts", Users, p),
        ],
      },
      {
        id: "seo-tools",
        label: "Tools",
        items: [
          leaf("tools-home", "All tools", "/dashboard/seo/tools", Wand2, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  Email  ──────────────────────────── */
  {
    prefix: "/dashboard/email",
    heading: "Email",
    caption: "Email marketing & inbox",
    build: (p) => [
      {
        id: "email-main",
        label: "Workspace",
        items: [
          leaf("home", "Overview", "/dashboard/email", Home, p),
          leaf("inbox", "Inbox", "/dashboard/sabmail/inbox", Inbox, p),
          leaf("contacts", "Contacts", "/dashboard/email/contacts", Users, p),
          leaf("templates", "Templates", "/dashboard/email/templates", FileText, p),
          leaf("campaigns", "Campaigns", "/dashboard/email/campaigns", Megaphone, p),
        ],
      },
      {
        id: "email-ops",
        label: "Operations",
        items: [
          leaf("verification", "Verification", "/dashboard/email/verification", BadgeCheck, p),
          leaf("analytics", "Analytics", "/dashboard/email/analytics", BarChart3, p),
          leaf("settings", "Settings", "/dashboard/email/settings", Settings, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  SabSMS  ──────────────────────────── */
  {
    prefix: "/sabsms",
    heading: "SabSMS",
    caption: "SMS · MMS · RCS",
    build: (p) => [
      {
        id: "sabsms-main",
        label: "Workspace",
        items: [
          leaf("home", "Overview", "/sabsms", Home, p),
          leaf("inbox", "Inbox", "/sabsms/inbox", MessageSquare, p),
          leaf("campaigns", "Campaigns", "/sabsms/campaigns", Megaphone, p),
          leaf("templates", "Templates", "/sabsms/templates", FileText, p),
          leaf("drips", "Drip sequences", "/sabsms/drips", GitBranch, p),
        ],
      },
      {
        id: "sabsms-audience",
        label: "Audience",
        items: [
          leaf("contacts", "Contacts", "/sabsms/contacts", Users, p),
          leaf("suppressions", "Suppressions", "/sabsms/suppressions", ShieldCheck, p),
          leaf("consent", "Consent log", "/sabsms/consent", FileSearch, p),
        ],
      },
      {
        id: "sabsms-ops",
        label: "Operations",
        items: [
          leaf("numbers", "Numbers", "/sabsms/numbers", Phone, p),
          leaf("providers", "Providers", "/sabsms/providers", ServerCog, p),
          leaf("analytics", "Analytics", "/sabsms/analytics", BarChart3, p),
          leaf("compliance", "Compliance", "/sabsms/compliance", ShieldCheck, p),
          leaf("logs", "Message logs", "/sabsms/logs", FileSearch, p),
          leaf("webhooks", "Webhooks", "/sabsms/webhooks", Webhook, p),
          leaf("api-keys", "API keys", "/sabsms/api-keys", Code2, p),
          leaf("settings", "Settings", "/sabsms/settings", Settings, p),
        ],
      },
    ],
  },

  /* ───────────────────────  SabSites (Website Builder)  ───────────── */
  // The builder itself is the full-screen Webstudio-powered app at /sites;
  // this sidebar only covers the /dashboard/website-builder gate page.
  {
    prefix: "/dashboard/website-builder",
    heading: "SabSites",
    caption: "Visual website builder",
    build: (p) => [
      {
        id: "website-main",
        label: "Workspace",
        items: [
          leaf("home", "Open SabSites", "/sites/dashboard", Globe, p, { exact: true }),
        ],
      },
      {
        id: "website-tools",
        label: "Tools",
        items: [
          leaf("portfolio", "Portfolio sites", "/dashboard/portfolio", Brush, p),
          leaf("links", "URL shortener", "/dashboard/url-shortener", LinkIcon, p),
          leaf("qr", "QR codes", "/dashboard/qr-code-maker", QrCode, p),
          leaf("seo", "SEO projects", "/dashboard/seo", Search, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  URL Shortener  ──────────────────── */
  {
    prefix: "/dashboard/url-shortener",
    heading: "URL Shortener",
    caption: "Short links & UTM tracking",
    build: (p) => [
      {
        id: "url-main",
        label: "Workspace",
        items: [
          leaf("home", "All links", "/dashboard/url-shortener", LinkIcon, p, { exact: true }),
          leaf("bio", "Link in Bio", "/dashboard/url-shortener/bio", FileText, p),
        ],
      },
      {
        id: "url-settings",
        label: "Settings",
        items: [
          leaf("settings", "Settings", "/dashboard/url-shortener/settings", Settings, p, { exact: true }),
          leaf("webhooks", "Webhooks", "/dashboard/url-shortener/settings/webhooks", Webhook, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  SabFiles  ───────────────────────── */
  {
    prefix: "/dashboard/sabfiles",
    heading: "SabFiles",
    caption: "Cloud file manager",
    build: (p) => [
      {
        id: "sabfiles-main",
        label: "Workspace",
        items: [
          leaf("home", "My files", "/dashboard/sabfiles", FolderOpen, p, { exact: true }),
          leaf("recent", "Recent", "/dashboard/sabfiles/recent", History, p),
          leaf("starred", "Starred", "/dashboard/sabfiles/starred", Star, p),
          leaf("shared", "Shared by me", "/dashboard/sabfiles/shared", Share2, p),
          leaf("shared-with-me", "Shared with me", "/dashboard/sabfiles/shared-with-me", Users, p),
          leaf("trash", "Trash", "/dashboard/sabfiles/trash", Trash2, p),
        ],
      },
      {
        id: "sabfiles-vault",
        label: "Sab Vault",
        items: [
          leaf("vault", "Vault", "/dashboard/sabfiles/vault", ShieldCheck, p),
        ],
      },
      {
        id: "sabfiles-ops",
        label: "Operations",
        items: [
          leaf("storage", "Storage usage", "/dashboard/sabfiles/storage", HardDrive, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  QR Code Maker  ──────────────────── */
  {
    prefix: "/dashboard/qr-code-maker",
    heading: "QR Code",
    caption: "Static & dynamic QR codes",
    build: (p) => [
      {
        id: "qr-main",
        label: "Workspace",
        items: [
          leaf("home", "Generator", "/dashboard/qr-code-maker", QrCode, p, { exact: true }),
          leaf("campaigns", "Campaigns", "/dashboard/qr-code-maker/campaigns", LayoutGrid, p),
        ],
      },
      {
        id: "qr-settings",
        label: "Settings",
        items: [
          leaf("settings", "Settings", "/dashboard/qr-code-maker/settings", Settings, p, { exact: true }),
          leaf("brand-kit", "Brand Kit", "/dashboard/qr-code-maker/settings/brand-kit", Palette, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  Team  ───────────────────────────── */
  {
    prefix: "/dashboard/team",
    heading: "Team",
    caption: "Members, roles & chat",
    build: (p) => [
      {
        id: "team-main",
        label: "Workspace",
        items: [
          leaf("home", "Overview", "/dashboard/team", Home, p),
          leaf("members", "Members", "/dashboard/team/manage-users", Users, p),
          leaf("roles", "Roles", "/dashboard/team/manage-roles", Shield, p),
          leaf("invites", "Invites", "/dashboard/team/invites", UserPlus, p),
          leaf("tasks", "Tasks", "/dashboard/team/tasks", ListChecks, p),
          leaf("chat", "Team chat", "/dashboard/team/team-chat", MessagesSquare, p),
          leaf("activity", "Activity", "/dashboard/team/activity", Activity, p),
        ],
      },
      {
        id: "team-ops",
        label: "Operations",
        items: [
          leaf("notifications", "Notifications", "/dashboard/team/notifications", Bell, p),
          leaf("settings", "Settings", "/dashboard/team/settings", Settings, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  Global Settings  ─────────────────
   *
   * Owns ONLY `/dashboard/settings/*` (profile / security / billing /
   * etc.). It's a peer to product modules — its own dock icon, its own
   * sidebar. Clicking "Settings" inside a product app (CRM, Email,
   * WaChat, …) NEVER lands here — those go to the app's own settings
   * URL.  This config exists strictly so /dashboard/settings/* itself
   * has a sensible sidebar.
   */
  {
    prefix: "/dashboard/settings",
    heading: "Settings",
    caption: "Account & developer",
    build: (p) => [
      {
        id: "settings-account",
        label: "Account",
        items: [
          leaf("profile", "Profile", "/dashboard/settings/profile", User, p),
          leaf("security", "Security", "/dashboard/settings/security", Shield, p),
          leaf("notifications", "Notifications", "/dashboard/settings/notifications", Bell, p),
          leaf("ui", "Appearance", "/dashboard/settings/ui", Palette, p),
        ],
      },
      {
        id: "settings-dev",
        label: "Developer",
        items: [
          leaf("api-keys", "API keys", "/dashboard/settings/api-keys", Key, p),
          leaf("webhooks", "Webhooks", "/dashboard/settings/webhooks", Webhook, p),
          leaf("integrations", "Integrations", "/dashboard/settings/integrations", Puzzle, p),
        ],
      },
      {
        id: "settings-billing",
        label: "Billing",
        items: [
          leaf("billing", "Billing & plan", "/dashboard/settings/billing", CreditCard, p),
          leaf("credits", "Credits", "/dashboard/settings/credits", Star, p),
          leaf("invoices", "Invoices", "/dashboard/settings/invoices", Receipt, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  N8N  ────────────────────────────── */
  {
    prefix: "/dashboard/n8n",
    heading: "SabFlow",
    caption: "Workflow automation",
    build: (p) => [
      {
        id: "n8n-main",
        label: "Workspace",
        items: [leaf("home", "Workflows", "/dashboard/n8n", Workflow, p)],
      },
    ],
  },

  /* ─────────────────────────────  Portfolio  ──────────────────────── */
  {
    prefix: "/dashboard/portfolio",
    heading: "Portfolio",
    caption: "Personal websites",
    build: (p) => [
      {
        id: "portfolio-main",
        label: "Workspace",
        items: [leaf("home", "Sites", "/dashboard/portfolio", Globe, p)],
      },
    ],
  },

  /* ─────────────────────────────  Marketplace  ────────────────────── */
  {
    prefix: "/dashboard/marketplace",
    heading: "Marketplace",
    caption: "Apps & integrations",
    build: (p) => [
      {
        id: "marketplace-main",
        label: "Workspace",
        items: [
          leaf("home", "Browse", "/dashboard/marketplace", ShoppingBag, p),
          leaf("installed", "Installed", "/dashboard/marketplace/installed", CheckCircle2, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  Plans (no index — only [planId]) ─ */
  {
    prefix: "/dashboard/plans",
    heading: "Plans",
    caption: "Subscription plans",
    build: () => [
      {
        id: "plans-main",
        label: "Plans",
        items: [],
      },
    ],
  },

  /* ─────────────────────────  Suite modules  ────────────────────────
   *
   * Per-module sidebar configs live in ./module-sidebars/<module>.tsx
   * (one file per app — SabDesk, SabCheckout, SabSign, …). They are
   * spread here so they win over the `/dashboard` catch-all below.
   */
  ...MODULE_SIDEBARS,

  /* ─────────────────────────────  Home (catch-all)  ─────────────────
   *
   * Home is a peer to other product apps. Its sidebar exposes the
   * user's global account utilities (notifications, credit usage,
   * billing) and shortcuts to other apps. Account-level Settings sub-
   * pages (profile / security / api-keys / billing / etc.) live in
   * the Settings dock app — NOT here. Per-app settings live in each
   * product app's own sidebar at that app's URL.
   */
  {
    prefix: "/dashboard",
    heading: "Home",
    caption: "Account overview",
    build: (p) => [
      {
        id: "home-main",
        label: "Workspace",
        items: [
          leaf("home", "Home", "/dashboard", Home, p),
          leaf("notifications", "Notifications", "/dashboard/notifications", Bell, p),
          leaf("setup", "Setup", "/wachat/setup", Sparkles, p),
          leaf("notif-prefs", "Notification prefs", "/dashboard/notification-preferences", BellOff, p),
          leaf("credit-usage", "Credit usage", "/dashboard/credit-usage", Coins, p),
          leaf("billing", "Billing", "/dashboard/billing", CreditCard, p),
          leaf("api-keys", "API keys", "/dashboard/api-keys", Key, p),
        ],
      },
      {
        id: "home-shortcuts",
        label: "Shortcuts",
        items: [
          leaf("wachat", "WaChat inbox", "/wachat", Smartphone, p),
          leaf("email", "Email", "/dashboard/email", Mail, p),
          leaf("seo", "SEO", "/dashboard/seo", Search, p),
        ],
      },
    ],
  },
];

/** Returns the first sidebar config whose prefix matches the pathname. */
export function findAppSidebarConfig(
  pathname: string | null | undefined,
): SabAppSidebarConfig | undefined {
  if (!pathname) return undefined;
  return SAB_APP_SIDEBARS.find((cfg) => pathname.startsWith(cfg.prefix));
}
