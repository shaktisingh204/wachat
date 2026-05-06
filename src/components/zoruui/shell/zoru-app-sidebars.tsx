"use client";

/**
 * Per-app sidebar registry.
 *
 * Maps pathname prefixes to grouped sidebar menu configs. ZoruHomeShell
 * consults this when no explicit `sidebarGroups` prop is passed — so as
 * the user navigates between apps, the sidebar swaps to the menu set for
 * the currently active app.
 *
 * The registry is checked in order; first matching `prefix` wins. Put
 * deeper routes first (e.g. `/dashboard/facebook` before `/dashboard`).
 */

import type { ComponentType, SVGProps } from "react";
import {
  Activity,
  Archive,
  ArrowDown,
  AtSign,
  BadgeCheck,
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Code2,
  Coins,
  Compass,
  CreditCard,
  Database,
  FileImage,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Files,
  Filter,
  Flag,
  GitBranch,
  Globe,
  Heart,
  History,
  Home,
  Image as ImageIcon,
  Inbox,
  Instagram,
  Key,
  Layers,
  Lightbulb,
  Link as LinkIcon,
  Link2,
  ListChecks,
  Loader,
  LogOut,
  Mail,
  Map as MapIcon,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MessagesSquare,
  Mic,
  Network,
  Package,
  Palette,
  Paperclip,
  Pause,
  Phone,
  PieChart,
  Pin,
  Play,
  Plus,
  PlusCircle,
  Puzzle,
  QrCode,
  Receipt,
  Repeat,
  Rocket,
  Search,
  Send,
  Server,
  ServerCog,
  Settings,
  Share2,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  Target,
  Ticket,
  Timer,
  TrendingUp,
  Trophy,
  Truck,
  User,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Video,
  Wallet,
  Wand2,
  Webhook,
  Workflow,
} from "lucide-react";

import type { ZoruSidebarGroup } from "./zoru-app-sidebar";

export interface ZoruAppSidebarConfig {
  /** Pathname prefix that activates this config. */
  prefix: string;
  /** Heading shown above the menu (the app's name). */
  heading: string;
  /** Optional caption under the heading. */
  caption?: string;
  /** Builder receives current pathname so each item can flag `active`. */
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
    active: pathname === href || (href !== "/" && pathname.startsWith(href + "/")),
  };
}

/* ────────────────────────────────────────────────────────────────────
 * Per-app menus.
 *
 * The ordering here matters — `findAppSidebarConfig` returns the first
 * config whose `prefix` matches the current pathname. Deeper-prefixed
 * apps must come BEFORE the catch-all `/dashboard` config, otherwise
 * /dashboard/foo would always match the home menu.
 * ────────────────────────────────────────────────────────────────── */

export const ZORU_APP_SIDEBARS: ZoruAppSidebarConfig[] = [
  /* WaChat ─────────── handled by WachatShell directly; left here for
     completeness so any /wachat page that doesn't go through that shell
     still gets a wachat sidebar. */
  {
    prefix: "/wachat",
    heading: "WaChat",
    caption: "WhatsApp workspace",
    build: (p) => [
      {
        id: "inbox",
        label: "Inbox",
        items: [
          leaf("home", "Overview", "/wachat/overview", Home, p),
          leaf("chat", "Chat", "/wachat/chat", MessageSquare, p),
          leaf("contacts", "Contacts", "/wachat/contacts", Users, p),
        ],
      },
      {
        id: "outbound",
        label: "Outbound",
        items: [
          leaf("broadcasts", "Broadcasts", "/wachat/broadcasts", Megaphone, p),
          leaf("templates", "Templates", "/wachat/templates", FileText, p),
          leaf("flows", "Meta Flows", "/wachat/flows", GitBranch, p),
          leaf("flow-builder", "Flow builder", "/wachat/flow-builder", Workflow, p),
          leaf("scheduled", "Scheduled", "/wachat/scheduled-messages", Calendar, p),
        ],
      },
      {
        id: "engage",
        label: "Engage",
        items: [
          leaf("calls", "Calls", "/wachat/calls", Phone, p),
          leaf("auto-reply", "Auto-reply", "/wachat/auto-reply", Repeat, p),
          leaf("quick-replies", "Quick replies", "/wachat/saved-replies", Bookmark, p),
          leaf("tags", "Tags", "/wachat/message-tags", Tag, p),
        ],
      },
      {
        id: "commerce",
        label: "Commerce",
        items: [
          leaf("catalog", "Catalog", "/wachat/catalog", ShoppingBag, p),
          leaf("payments", "Payments", "/wachat/whatsapp-pay", CreditCard, p),
        ],
      },
      {
        id: "analytics",
        label: "Analytics",
        items: [
          leaf("analytics", "Analytics", "/wachat/analytics", BarChart3, p),
          leaf("delivery", "Delivery reports", "/wachat/delivery-reports", CheckCheck, p),
          leaf("health", "Account health", "/wachat/health", Activity, p),
        ],
      },
      {
        id: "wachat-settings",
        label: "Settings",
        items: [
          leaf("agents", "Agents & roles", "/wachat/settings/agents", UserCog, p),
          leaf("attributes", "Attributes", "/wachat/settings/attributes", Layers, p),
          leaf("canned", "Canned messages", "/wachat/settings/canned", BookOpen, p),
          leaf("general", "General", "/wachat/settings/general", Settings, p),
          leaf("integrations", "Integrations", "/wachat/integrations", Puzzle, p),
        ],
      },
    ],
  },

  /* Meta Suite ─────────── */
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
          leaf("projects", "All projects", "/dashboard/facebook/all-projects", Briefcase, p),
          leaf("setup", "Setup", "/dashboard/facebook/setup", Sparkles, p),
          leaf("settings", "Page settings", "/dashboard/facebook/settings", Settings, p),
          leaf("roles", "Page roles", "/dashboard/facebook/page-roles", UserCog, p),
        ],
      },
      {
        id: "meta-content",
        label: "Content",
        items: [
          leaf("posts", "Posts", "/dashboard/facebook/posts", FileText, p),
          leaf("scheduled", "Scheduled", "/dashboard/facebook/scheduled-posts", Calendar, p),
          leaf("reels", "Reels", "/dashboard/facebook/reels", Video, p),
          leaf("stories", "Stories", "/dashboard/facebook/stories", ImageIcon, p),
          leaf("live", "Live", "/dashboard/facebook/live", Mic, p),
        ],
      },
      {
        id: "meta-engage",
        label: "Engagement",
        items: [
          leaf("inbox", "Inbox", "/dashboard/facebook/inbox", Inbox, p),
          leaf("comments", "Comments", "/dashboard/facebook/comments", MessageCircle, p),
          leaf("audience", "Audience", "/dashboard/facebook/audience", Users, p),
          leaf("subscribers", "Subscribers", "/dashboard/facebook/subscribers", BadgeCheck, p),
        ],
      },
      {
        id: "meta-commerce",
        label: "Commerce",
        items: [
          leaf("catalog", "Catalog", "/dashboard/facebook/catalog", ShoppingBag, p),
          leaf("ecomm", "Custom e-commerce", "/dashboard/facebook/custom-ecommerce", ShoppingCart, p),
        ],
      },
      {
        id: "meta-insights",
        label: "Insights",
        items: [
          leaf("insights", "Insights", "/dashboard/facebook/insights", BarChart3, p),
          leaf("analytics", "Analytics", "/dashboard/facebook/analytics", PieChart, p),
        ],
      },
    ],
  },

  /* Ad Manager ─────────── */
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
        ],
      },
      {
        id: "ad-build",
        label: "Build",
        items: [
          leaf("create", "Create campaign", "/dashboard/ad-manager/create", Plus, p),
          leaf("campaigns", "Campaigns", "/dashboard/ad-manager/campaigns", Megaphone, p),
          leaf("adsets", "Ad sets", "/dashboard/ad-manager/ad-sets", Layers, p),
          leaf("ads", "Ads", "/dashboard/ad-manager/ads", FileImage, p),
        ],
      },
      {
        id: "ad-measure",
        label: "Measure",
        items: [
          leaf("reports", "Reports", "/dashboard/ad-manager/reports", BarChart3, p),
          leaf("audiences", "Audiences", "/dashboard/ad-manager/audiences", Users, p),
        ],
      },
    ],
  },

  /* SabFlow ─────────── */
  {
    prefix: "/dashboard/sabflow",
    heading: "SabFlow",
    caption: "Visual flow builder",
    build: (p) => [
      {
        id: "sabflow-main",
        label: "Workspace",
        items: [
          leaf("flows", "All flows", "/dashboard/sabflow/flow-builder", Workflow, p),
          leaf("templates", "Templates", "/dashboard/sabflow/templates", FileText, p),
          leaf("history", "History", "/dashboard/sabflow/history", History, p),
        ],
      },
    ],
  },

  /* SabChat ─────────── */
  {
    prefix: "/dashboard/sabchat",
    heading: "SabChat",
    caption: "Multi-agent inbox",
    build: (p) => [
      {
        id: "sabchat-main",
        label: "Inbox",
        items: [
          leaf("inbox", "Conversations", "/dashboard/sabchat/inbox", Inbox, p),
          leaf("widgets", "Widgets", "/dashboard/sabchat/widgets", Code2, p),
          leaf("agents", "Agents", "/dashboard/sabchat/agents", UserCog, p),
          leaf("settings", "Settings", "/dashboard/sabchat/settings", Settings, p),
        ],
      },
    ],
  },

  /* Telegram ─────────── */
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
        ],
      },
      {
        id: "tg-content",
        label: "Content",
        items: [
          leaf("messages", "Messages", "/dashboard/telegram/messages", MessageSquare, p),
          leaf("broadcasts", "Broadcasts", "/dashboard/telegram/broadcasts", Megaphone, p),
          leaf("templates", "Templates", "/dashboard/telegram/templates", FileText, p),
          leaf("scheduled", "Scheduled", "/dashboard/telegram/scheduled", Calendar, p),
        ],
      },
    ],
  },

  /* Instagram ─────────── */
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
          leaf("media", "Media library", "/dashboard/instagram/media", Files, p),
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

  /* CRM ─────────── */
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
          leaf("search", "Search", "/dashboard/crm/search", Search, p),
        ],
      },
    ],
  },

  /* HRM ─────────── */
  {
    prefix: "/dashboard/hrm",
    heading: "HR Manager",
    caption: "People & payroll",
    build: (p) => [
      {
        id: "hrm-people",
        label: "People",
        items: [
          leaf("home", "Home", "/dashboard/hrm", Home, p),
          leaf("hr", "HR overview", "/dashboard/hrm/hr", Users, p),
          leaf("directory", "Directory", "/dashboard/hrm/hr/directory", UserCheck, p),
          leaf("org-chart", "Org chart", "/dashboard/hrm/hr/org-chart", Network, p),
          leaf("onboarding", "Onboarding", "/dashboard/hrm/hr/onboarding", UserPlus, p),
          leaf("offers", "Offers", "/dashboard/hrm/hr/offers", FileText, p),
          leaf("candidates", "Candidates", "/dashboard/hrm/hr/candidates", Search, p),
          leaf("jobs", "Jobs", "/dashboard/hrm/hr/jobs", Briefcase, p),
          leaf("interviews", "Interviews", "/dashboard/hrm/hr/interviews", Users, p),
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
          leaf("careers", "Careers page", "/dashboard/hrm/hr/careers-page", Globe, p),
        ],
      },
      {
        id: "hrm-payroll",
        label: "Payroll",
        items: [
          leaf("payroll", "Payroll", "/dashboard/hrm/payroll", Wallet, p),
        ],
      },
    ],
  },

  /* SEO Suite ─────────── */
  {
    prefix: "/dashboard/seo",
    heading: "SEO Suite",
    caption: "Site audits, tools & rankings",
    build: (p) => [
      {
        id: "seo-projects",
        label: "Projects",
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

  /* Email ─────────── */
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

  /* SMS ─────────── */
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

  /* URL Shortener ─────────── */
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

  /* QR Code Maker ─────────── */
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

  /* Team ─────────── */
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

  /* Settings ─────────── */
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

  /* N8N ─────────── */
  {
    prefix: "/dashboard/n8n",
    heading: "n8n",
    caption: "Workflow automation",
    build: (p) => [
      {
        id: "n8n-main",
        label: "Workspace",
        items: [
          leaf("home", "Workflows", "/dashboard/n8n", Workflow, p),
        ],
      },
    ],
  },

  /* Portfolio ─────────── */
  {
    prefix: "/dashboard/portfolio",
    heading: "Portfolio",
    caption: "Personal websites",
    build: (p) => [
      {
        id: "portfolio-main",
        label: "Workspace",
        items: [
          leaf("home", "Sites", "/dashboard/portfolio", Globe, p),
        ],
      },
    ],
  },

  /* Marketplace ─────────── */
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

  /* Plans ─────────── */
  {
    prefix: "/dashboard/plans",
    heading: "Plans",
    caption: "Subscription plans",
    build: (p) => [
      {
        id: "plans-main",
        label: "Workspace",
        items: [
          leaf("home", "All plans", "/dashboard/plans", CreditCard, p),
        ],
      },
    ],
  },

  /* Account dashboard root — catch-all, must come LAST. */
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
          leaf("credits", "Credit usage", "/dashboard/credit-usage", Coins, p),
          leaf("api-keys", "API keys", "/dashboard/api-keys", Key, p),
          leaf("billing", "Billing", "/dashboard/billing", CreditCard, p),
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
