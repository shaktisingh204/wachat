"use client";

/**
 * Per-app sidebar registry.
 *
 * Maps pathname prefixes to grouped sidebar menu configs. ZoruHomeShell
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
  Archive,
  ArrowDown,
  AtSign,
  BadgeCheck,
  BarChart3,
  Bell,
  BellOff,
  Bookmark,
  BookOpen,
  Briefcase,
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
  TrendingUp,
  Trophy,
  Truck,
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

import type { ZoruSidebarGroup } from "./zoru-app-sidebar";

export interface ZoruAppSidebarConfig {
  prefix: string;
  heading: string;
  caption?: string;
  build: (pathname: string) => ZoruSidebarGroup[];
}

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

function leaf(
  id: string,
  label: string,
  href: string,
  IconComp: Icon,
  pathname: string,
) {
  return {
    id,
    label,
    href,
    icon: <IconComp />,
    active:
      pathname === href || (href !== "/" && pathname.startsWith(href + "/")),
  };
}

/* ────────────────────────────────────────────────────────────────────
 * Per-app menus.  Order matters — deeper-prefixed apps must come BEFORE
 * the catch-all `/dashboard`.
 * ────────────────────────────────────────────────────────────────── */

export const ZORU_APP_SIDEBARS: ZoruAppSidebarConfig[] = [
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
          leaf("interactive", "Interactive messages", "/wachat/interactive-messages", Sparkles, p),
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
          leaf("home", "All flows", "/dashboard/sabflow/flow-builder", Workflow, p),
          leaf("logs", "Logs", "/dashboard/sabflow/logs", FileSearch, p),
          leaf("connections", "Connections", "/dashboard/sabflow/connections", Plug, p),
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
        label: "Account",
        items: [
          leaf("home", "Home", "/dashboard/telegram", Home, p),
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

  /* ─────────────────────────────  CRM  ────────────────────────────── */
  {
    prefix: "/dashboard/crm",
    heading: "CRM",
    caption: "Sales, projects & operations",
    build: (p) => [
      {
        id: "crm-overview",
        label: "Overview",
        items: [
          leaf("home", "Home", "/dashboard/crm", Home, p),
          leaf("workspace", "Workspace", "/dashboard/crm/workspace", Briefcase, p),
          leaf("activity", "Activity", "/dashboard/crm/activity", Activity, p),
          leaf("mentions", "Mentions", "/dashboard/crm/mentions", AtSign, p),
          leaf("notifications", "Notifications", "/dashboard/crm/notifications", Bell, p),
          leaf("pinned", "Pinned", "/dashboard/crm/pinned", Pin, p),
          leaf("search", "Search", "/dashboard/crm/search", Search, p),
        ],
      },
      {
        id: "crm-sales",
        label: "Sales",
        items: [
          leaf("sales-crm", "Pipeline", "/dashboard/crm/sales-crm", TrendingUp, p),
          leaf("sales", "Sales", "/dashboard/crm/sales", CircleDollarSign, p),
          leaf("deals", "Deals", "/dashboard/crm/deals", Trophy, p),
          leaf("contracts", "Contracts", "/dashboard/crm/contracts", FileText, p),
          leaf("contacts", "Contacts", "/dashboard/crm/contacts", Users, p),
          leaf("accounts", "Accounts", "/dashboard/crm/accounts", Building2, p),
          leaf("auto-leads", "Auto leads", "/dashboard/crm/auto-leads-setup", Wand2, p),
        ],
      },
      {
        id: "crm-delivery",
        label: "Delivery",
        items: [
          leaf("projects", "Projects", "/dashboard/crm/projects", ListChecks, p),
          leaf("tasks", "Tasks", "/dashboard/crm/tasks", Check, p),
          leaf("tickets", "Tickets", "/dashboard/crm/tickets", Ticket, p),
          leaf("time", "Time tracking", "/dashboard/crm/time-tracking", Timer, p),
        ],
      },
      {
        id: "crm-finance",
        label: "Finance",
        items: [
          leaf("accounting", "Accounting", "/dashboard/crm/accounting", Wallet, p),
          leaf("banking", "Banking", "/dashboard/crm/banking", CreditCard, p),
          leaf("purchases", "Purchases", "/dashboard/crm/purchases", ShoppingCart, p),
          leaf("inventory", "Inventory", "/dashboard/crm/inventory", Package, p),
          leaf("products", "Products", "/dashboard/crm/products", ShoppingBag, p),
        ],
      },
      {
        id: "crm-comms",
        label: "Communications",
        items: [
          leaf("messages", "Messages", "/dashboard/crm/messages", MessageSquare, p),
          leaf("email", "Email", "/dashboard/crm/email", Mail, p),
          leaf("automations", "Automations", "/dashboard/crm/automations", Workflow, p),
        ],
      },
      {
        id: "crm-team",
        label: "Team & data",
        items: [
          leaf("team", "Team", "/dashboard/crm/team", Users, p),
          leaf("files", "Files", "/dashboard/crm/files", Files, p),
          leaf("reports", "Reports", "/dashboard/crm/reports", BarChart3, p),
          leaf("analytics", "Analytics", "/dashboard/crm/analytics", PieChart, p),
          leaf("integrations", "Integrations", "/dashboard/crm/integrations", Puzzle, p),
          leaf("setup", "Setup", "/dashboard/crm/setup", Sparkles, p),
          leaf("settings", "Settings", "/dashboard/crm/settings", Settings, p),
        ],
      },
    ],
  },

  /* ─────────────────────────────  HRM  ────────────────────────────── */
  {
    prefix: "/dashboard/hrm",
    heading: "HR Manager",
    caption: "People, payroll & culture",
    build: (p) => [
      {
        id: "hrm-overview",
        label: "Overview",
        items: [
          leaf("home", "Home", "/dashboard/hrm", Home, p),
          leaf("hr", "HR overview", "/dashboard/hrm/hr", Users, p),
        ],
      },
      {
        id: "hrm-people",
        label: "People",
        items: [
          leaf("directory", "Directory", "/dashboard/hrm/hr/directory", UserCheck, p),
          leaf("org-chart", "Org chart", "/dashboard/hrm/hr/org-chart", Network, p),
          leaf("onboarding", "Onboarding", "/dashboard/hrm/hr/onboarding", UserPlus, p),
          leaf("offers", "Offers", "/dashboard/hrm/hr/offers", FileText, p),
          leaf("candidates", "Candidates", "/dashboard/hrm/hr/candidates", Search, p),
          leaf("jobs", "Jobs", "/dashboard/hrm/hr/jobs", Briefcase, p),
          leaf("interviews", "Interviews", "/dashboard/hrm/hr/interviews", Users, p),
          leaf("careers", "Careers page", "/dashboard/hrm/hr/careers-page", Globe, p),
        ],
      },
      {
        id: "hrm-perf",
        label: "Performance",
        items: [
          leaf("okrs", "OKRs", "/dashboard/hrm/hr/okrs", Target, p),
          leaf("training", "Training", "/dashboard/hrm/hr/training", BookOpen, p),
          leaf("learning", "Learning paths", "/dashboard/hrm/hr/learning-paths", MapIcon, p),
          leaf("feedback", "360° feedback", "/dashboard/hrm/hr/feedback-360", MessagesSquare, p),
          leaf("recognition", "Recognition", "/dashboard/hrm/hr/recognition", Star, p),
          leaf("one-on-ones", "One-on-ones", "/dashboard/hrm/hr/one-on-ones", MessageCircle, p),
          leaf("succession", "Succession", "/dashboard/hrm/hr/succession", TrendingUp, p),
        ],
      },
      {
        id: "hrm-time",
        label: "Time & expenses",
        items: [
          leaf("timesheets", "Timesheets", "/dashboard/hrm/hr/timesheets", Timer, p),
          leaf("travel", "Travel", "/dashboard/hrm/hr/travel", Globe, p),
          leaf("expenses", "Expense claims", "/dashboard/hrm/hr/expense-claims", Receipt, p),
          leaf("compensation", "Compensation", "/dashboard/hrm/hr/compensation-bands", Coins, p),
        ],
      },
      {
        id: "hrm-docs",
        label: "Documents",
        items: [
          leaf("policies", "Policies", "/dashboard/hrm/hr/policies", FileText, p),
          leaf("documents", "Documents", "/dashboard/hrm/hr/documents", Files, p),
          leaf("templates", "Doc templates", "/dashboard/hrm/hr/document-templates", FileSpreadsheet, p),
          leaf("certifications", "Certifications", "/dashboard/hrm/hr/certifications", BadgeCheck, p),
          leaf("welcome-kit", "Welcome kit", "/dashboard/hrm/hr/welcome-kit", Heart, p),
        ],
      },
      {
        id: "hrm-assets",
        label: "Assets & exits",
        items: [
          leaf("assets", "Assets", "/dashboard/hrm/hr/assets", Package, p),
          leaf("assignments", "Assignments", "/dashboard/hrm/hr/asset-assignments", ClipboardList, p),
          leaf("probation", "Probation", "/dashboard/hrm/hr/probation", Flag, p),
          leaf("exits", "Exits", "/dashboard/hrm/hr/exits", LogOut, p),
        ],
      },
      {
        id: "hrm-engage",
        label: "Engagement",
        items: [
          leaf("announcements", "Announcements", "/dashboard/hrm/hr/announcements", Megaphone, p),
          leaf("surveys", "Surveys", "/dashboard/hrm/hr/surveys", ClipboardList, p),
        ],
      },
      {
        id: "hrm-payroll",
        label: "Payroll",
        items: [
          leaf("payroll", "Payroll", "/dashboard/hrm/payroll", Wallet, p),
          leaf("employees", "Employees", "/dashboard/hrm/payroll/employees", Users, p),
          leaf("payslips", "Payslips", "/dashboard/hrm/payroll/payslips", Receipt, p),
          leaf("salary", "Salary structure", "/dashboard/hrm/payroll/salary-structure", DollarSign, p),
          leaf("attendance", "Attendance", "/dashboard/hrm/payroll/attendance", UserCheck, p),
          leaf("leave", "Leave", "/dashboard/hrm/payroll/leave", Calendar, p),
          leaf("holidays", "Holidays", "/dashboard/hrm/payroll/holidays", Calendar, p),
          leaf("shifts", "Shifts", "/dashboard/hrm/payroll/shifts", Clock, p),
          leaf("shift-rot", "Shift rotations", "/dashboard/hrm/payroll/shift-rotations", RotateCw, p),
          leaf("shift-change", "Shift changes", "/dashboard/hrm/payroll/shift-change-requests", Repeat, p),
          leaf("time-logs", "Time logs", "/dashboard/hrm/payroll/time-logs", Timer, p),
          leaf("weekly", "Weekly timesheets", "/dashboard/hrm/payroll/weekly-timesheets", Calendar, p),
          leaf("departments", "Departments", "/dashboard/hrm/payroll/departments", Building, p),
          leaf("designations", "Designations", "/dashboard/hrm/payroll/designations", Briefcase, p),
          leaf("appraisals", "Appraisals", "/dashboard/hrm/payroll/appraisal-reviews", Star, p),
          leaf("goals", "Goal setting", "/dashboard/hrm/payroll/goal-setting", Target, p),
          leaf("kpi", "KPI tracking", "/dashboard/hrm/payroll/kpi-tracking", Gauge, p),
          leaf("form-16", "Form 16", "/dashboard/hrm/payroll/form-16", FileText, p),
          leaf("pf-esi", "PF & ESI", "/dashboard/hrm/payroll/pf-esi", ShieldCheck, p),
          leaf("ptax", "Professional tax", "/dashboard/hrm/payroll/professional-tax", Percent, p),
          leaf("tds", "TDS", "/dashboard/hrm/payroll/tds", Percent, p),
          leaf("reports", "Reports", "/dashboard/hrm/payroll/reports", BarChart3, p),
          leaf("payroll-settings", "Payroll settings", "/dashboard/hrm/payroll/settings", Settings, p),
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
          leaf("home", "Home", "/dashboard/seo", Home, p),
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
          leaf("inbox", "Inbox", "/dashboard/email/inbox", Inbox, p),
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

  /* ─────────────────────────────  SMS  ────────────────────────────── */
  {
    prefix: "/dashboard/sms",
    heading: "SMS",
    caption: "SMS sending & DLT",
    build: (p) => [
      {
        id: "sms-main",
        label: "Workspace",
        items: [
          leaf("home", "Overview", "/dashboard/sms", Home, p),
          leaf("campaigns", "Campaigns", "/dashboard/sms/campaigns", Megaphone, p),
          leaf("campaigns-new", "New campaign", "/dashboard/sms/campaigns/new", Plus, p),
          leaf("templates", "Templates", "/dashboard/sms/templates", FileText, p),
          leaf("logs", "Logs", "/dashboard/sms/logs", FileSearch, p),
        ],
      },
      {
        id: "sms-ops",
        label: "Operations",
        items: [
          leaf("config", "Config", "/dashboard/sms/config", Settings, p),
          leaf("developer", "Developer", "/dashboard/sms/developer", Code2, p),
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
          leaf("home", "All links", "/dashboard/url-shortener", LinkIcon, p),
          leaf("settings", "Settings", "/dashboard/url-shortener/settings", Settings, p),
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
          leaf("home", "Generator", "/dashboard/qr-code-maker", QrCode, p),
          leaf("settings", "Settings", "/dashboard/qr-code-maker/settings", Settings, p),
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
    heading: "n8n",
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
          leaf("setup", "Setup", "/dashboard/setup", Sparkles, p),
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
          leaf("crm", "CRM", "/dashboard/crm", Briefcase, p),
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
): ZoruAppSidebarConfig | undefined {
  if (!pathname) return undefined;
  return ZORU_APP_SIDEBARS.find((cfg) => pathname.startsWith(cfg.prefix));
}
