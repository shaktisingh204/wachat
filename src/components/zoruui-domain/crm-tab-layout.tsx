'use client';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Button, Avatar, AvatarImage, AvatarFallback, Skeleton, Drawer, DrawerTrigger, Collapsible, CollapsibleContent, CollapsibleTrigger, Separator, Sheet, Badge, cn } from '@/components/sabcrm/20ui/compat';
import {
  usePathname,
  useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Send,
  GitFork,
  Settings,
  Briefcase,
  ChevronDown,
  FileText,
  Phone,
  Webhook,
  History,
  LogOut,
  CreditCard,
  LoaderCircle,
  Megaphone,
  ServerCog,
  ShoppingBag,
  Link as LinkIcon,
  QrCode,
  BarChart,
  Server,
  Brush,
  Handshake,
  Building,
  Mail,
  Zap,
  FolderKanban,
  Repeat,
  Inbox,
  Package,
  Compass,
  Search,
  Star,
  Video,
  Bot,
  ShieldCheck,
  Key,
  BookCopy,
  Rss,
  ChevronsUpDown,
  TrendingUp,
  PanelLeft,
  Sparkles,
  ChevronRight,
  Calendar,
  Database,
  User as UserIcon,
  Wrench,
  Newspaper,
  Clapperboard,
  Pencil,
  BarChart2,
  Globe,
  Landmark,
  Users as UsersIcon,
  LifeBuoy,
  HelpCircle,
  LayoutGrid,
} from 'lucide-react';
import { SabNodeLogo } from '@/components/zoruui-domain/logo';
import { MetaIcon,
  WhatsAppIcon,
  SeoIcon,
  CustomEcommerceIcon,
  InstagramIcon,
  SabChatIcon,
  TelegramIcon,
  CrmIcon,
  SabWaIcon } from '@/components/zoruui-domain/custom-sidebar-components';
import { Workflow,
  MessageSquareText,
  UsersRound,
  Target,
  LayoutTemplate } from 'lucide-react';
import { getSession,
  getProjects } from '@/app/actions/index';
import { getDiwaliThemeStatus } from '@/app/actions/admin.actions';
import type { Plan,
  WithId,
  Project,
  User } from '@/lib/definitions';
import { FacebookProjectSwitcher } from '@/components/zoruui-domain/facebook-project-switcher';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarTrigger, SidebarProvider } from '@/components/sabcrm/20ui/compat';
import { ProjectProvider, useProject } from '@/context/project-context';

import React from 'react';
import Link from 'next/link';

const wachatMenuItems = [
    { href: '/wachat', label: 'All Projects', icon: Briefcase, roles: ['owner', 'admin', 'agent'] },
    { href: '/wachat/overview', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'admin'] },
    { href: '/wachat/chat', label: 'Live Chat', icon: MessageSquare, roles: ['owner', 'admin', 'agent'] },
    { href: '/wachat/contacts', label: 'Contacts', icon: Users, roles: ['owner', 'admin', 'agent'] },
    { href: '/wachat/broadcasts', label: 'Campaigns', icon: Send, roles: ['owner', 'admin'] },
    { href: '/wachat/templates', label: 'Templates', icon: FileText, roles: ['owner', 'admin'] },
    { href: '/wachat/catalog', label: 'Catalog', icon: ShoppingBag, roles: ['owner', 'admin'] },
    { href: '/wachat/calls', label: 'Calls', icon: Phone, roles: ['owner', 'admin'] },
    { href: '/wachat/flow-builder', label: 'Flow Builder', icon: GitFork, roles: ['owner', 'admin'] },
    { href: '/wachat/flows', label: 'Meta Flows', beta: true, icon: ServerCog, roles: ['owner', 'admin'] },
    { href: '/wachat/integrations', label: 'Integrations', icon: Zap, roles: ['owner', 'admin'] },
    { href: '/wachat/whatsapp-pay', label: 'WhatsApp Pay', icon: CreditCard, roles: ['owner', 'admin'] },
    { href: '/wachat/numbers', label: 'Numbers', icon: Phone, roles: ['owner', 'admin'] },
    { href: '/wachat/webhooks', label: 'Webhooks', icon: Webhook, roles: ['owner', 'admin'] },
    { href: '/dashboard/settings', label: 'Project Settings', icon: Settings, roles: ['owner', 'admin'] },
];

const crmMenuItems = [
    { href: "/dashboard/crm", label: "Dashboard", icon: BarChart, exact: true },
    { href: "/dashboard/sabbi/dashboards", label: "Custom Dashboards", icon: LayoutGrid },
    {
        href: "/dashboard/crm/sales",
        label: "Sales",
        icon: Handshake,
        subItems: [
            { href: "/dashboard/crm/sales/clients", label: "Clients & Prospects" },
            { href: "/dashboard/crm/sales/quotations", label: "Quotations & Estimates" },
            { href: "/dashboard/crm/sales/proforma", label: "Proforma Invoices" },
            { href: "/dashboard/crm/sales/orders", label: "Sales Orders" },
            { href: "/dashboard/crm/sales/delivery", label: "Delivery Challans" },
            { href: "/dashboard/crm/sales/invoices", label: "Invoices" },
            { href: "/dashboard/crm/sales/receipts", label: "Payment Receipts" },
            { href: "/dashboard/crm/sales/credit-notes", label: "Credit Notes" },
            { href: "/dashboard/crm/sales/subscriptions", label: "Subscriptions & Recurring" },
            { href: "/dashboard/crm/sales/contracts", label: "Contracts" },
            { href: "/dashboard/crm/sales/pipelines", label: "Sales Pipelines" },
            { href: "/dashboard/crm/sales/forms", label: "Sales Forms" },
            { href: "/dashboard/crm/sales/coupons", label: "Coupons & Promotions" },
            { href: "/dashboard/sabthrive/loyalty", label: "Loyalty Program" },
            { href: "/dashboard/crm/sales/gift-cards", label: "Gift Cards" },
        ]
    },
    {
        href: "/dashboard/crm/purchases",
        label: 'Purchases',
        icon: ShoppingBag,
        subItems: [
            { href: "/dashboard/crm/purchases/vendors", label: "Vendors & Suppliers" },
            { href: "/dashboard/crm/purchases/rfqs", label: "RFQs / Bids" },
            { href: "/dashboard/crm/purchases/expenses", label: "Purchases & Expenses" },
            { href: "/dashboard/crm/purchases/orders", label: "Purchase Orders" },
            { href: "/dashboard/crm/purchases/payouts", label: "Payout Receipts" },
            { href: "/dashboard/crm/purchases/debit-notes", label: "Debit Notes" },
            { href: "/dashboard/crm/purchases/leads", label: "Purchase Leads" },
            { href: "/dashboard/crm/purchases/hire", label: "Hire & Services" },
        ]
    },
    {
        href: '/dashboard/crm/inventory',
        label: 'Inventory',
        icon: Briefcase,
        subItems: [
            { href: "/dashboard/crm/inventory/items", label: "All Items" },
            { href: "/dashboard/crm/inventory/warehouses", label: "Warehouses" },
            { href: "/dashboard/crm/inventory/purchase-orders", label: "Purchase Orders" },
            { href: "/dashboard/crm/inventory/grn", label: "Goods Receipt (GRN)" },
            { href: "/dashboard/crm/inventory/bom", label: "Bill of Materials (BOM)" },
            { href: "/dashboard/crm/inventory/adjustments", label: "Stock Adjustments" },
            {
                label: 'Reports',
                subSubItems: [
                    { href: "/dashboard/crm/inventory/pnl", label: "Product-wise P&L" },
                    { href: "/dashboard/crm/inventory/stock-value", label: "Stock Value Report" },
                    { href: "/dashboard/crm/inventory/batch-expiry", label: "Batch Expiry Report" },
                    { href: "/dashboard/crm/inventory/party-transactions", label: "Party Transactions Report" },
                    { href: "/dashboard/crm/inventory/all-transactions", label: "All Transactions Report" },
                ],
            },
        ]
    },
    {
        href: "/dashboard/crm/accounting",
        label: "Accounting",
        icon: Database,
        subItems: [
            { href: "/dashboard/crm/accounting/groups", label: "Account Groups" },
            { href: "/dashboard/crm/accounting/charts", label: "Chart of Accounts" },
            { href: "/dashboard/crm/accounting/vouchers", label: "Voucher Books" },
            { href: "/dashboard/crm/budgets", label: "Budgets & Forecasting" },
            {
                label: 'Reports',
                subSubItems: [
                    { href: "/dashboard/crm/accounting/balance-sheet", label: "Balance Sheet" },
                    { href: "/dashboard/crm/accounting/trial-balance", label: "Trial Balance" },
                    { href: "/dashboard/crm/accounting/pnl", label: "Profit and Loss" },
                    { href: "/dashboard/crm/accounting/income-statement", label: "Income Statement" },
                    { href: "/dashboard/crm/accounting/day-book", label: "Day Book" },
                    { href: "/dashboard/crm/accounting/cash-flow", label: "Cash Flow Statement" },
                ],
            },
        ]
    },
    {
        href: "/dashboard/crm/sales-crm",
        label: "Sales CRM",
        icon: BarChart2,
        subItems: [
            {
                label: 'Leads',
                subSubItems: [
                    { href: "/dashboard/crm/contacts", label: "Contacts" },
                    { href: "/dashboard/crm/deals", label: "Deals Pipeline" },
                    { href: "/dashboard/crm/tasks", label: "Tasks" },
                    { href: "/dashboard/crm/automations", label: "Automations" },
                    { href: "/dashboard/crm/sales-crm/all-leads", label: "All Leads" },
                    { href: "/dashboard/crm/sales-crm/leads", label: "Leads" },
                ],
            },
            { href: "/dashboard/sabbigin/pipelines", label: "Pipelines" },
            { href: "/dashboard/crm/sales-crm/all-pipelines", label: "All Pipelines" },
            { href: "/dashboard/crm/sales-crm/pipeline-stages", label: "Pipeline Stages" },
            { href: "/dashboard/crm/sales-crm/statuses", label: "Statuses" },
            { href: "/dashboard/crm/sales-crm/sources", label: "Sources" },
            { href: "/dashboard/crm/sales-crm/categories", label: "Categories" },
            { href: "/dashboard/crm/sales-crm/products", label: "Products" },
            { href: "/dashboard/crm/sales-crm/agents", label: "Agents" },
            { href: "/dashboard/crm/sales-crm/forms", label: "Forms" },
            { href: "/dashboard/crm/sales-crm/custom-forms", label: "Custom Forms" },
            { href: "/dashboard/crm/sales-crm/notes", label: "Notes" },
            { href: "/dashboard/crm/sales-crm/consent", label: "Consent" },
            { href: "/dashboard/crm/sales-crm/settings", label: "Settings" },
            { href: "/dashboard/sabbi/analytics", label: "Analytics" },
            {
                label: 'Reports',
                subSubItems: [
                    { href: "/dashboard/crm/sales-crm/leads-summary", label: "Leads Summary" },
                    { href: "/dashboard/crm/sales-crm/team-sales-report", label: "Team Sales Report" },
                    { href: "/dashboard/crm/sales-crm/client-performance-report", label: "Client Performance Report" },
                    { href: "/dashboard/crm/sales-crm/lead-source-report", label: "Lead Source Report" },
                ],
            },
        ]
    },
    {
        href: "/dashboard/sabdesk",
        label: "Support",
        icon: LifeBuoy,
        subItems: [
            { href: "/dashboard/sabdesk", label: "Tickets" },
            { href: "/dashboard/sabdesk/sla", label: "SLA Policies" },
            { href: "/dashboard/sabdesk/knowledge-base", label: "Knowledge Base" },
            { href: "/dashboard/crm/service-contracts", label: "Service Contracts" },
        ],
    },
    {
        href: "/dashboard/crm/operations",
        label: "Operations",
        icon: Compass,
        subItems: [
            { href: "/dashboard/crm/bookings", label: "Bookings & Appointments" },
            { href: "/dashboard/crm/fixed-assets", label: "Fixed Assets" },
        ],
    },
    {
        href: "/dashboard/crm/banking",
        label: "Bank & Payments",
        icon: Landmark,
        subItems: [
            { href: "/dashboard/crm/banking/all", label: "All Payment Accounts" },
            { href: "/dashboard/crm/banking/bank-accounts", label: "Bank Accounts" },
            { href: "/dashboard/crm/banking/employee-accounts", label: "Employee Accounts" },
            { href: "/dashboard/crm/banking/bank-transactions", label: "Bank Transactions" },
            { href: "/dashboard/crm/banking/reconciliation", label: "Bank Reconciliation" },
            { href: "/dashboard/crm/petty-cash", label: "Petty Cash" },
            { href: "/dashboard/crm/loans", label: "Loans & Advances" },
        ]
    },
    {
        href: "/dashboard/hrm",
        label: "HR & Payroll",
        icon: UsersIcon,
        subItems: [
            {
                label: 'Recruitment',
                subSubItems: [
                    { href: "/dashboard/hrm/hr/jobs", label: "Job Postings" },
                    { href: "/dashboard/hrm/hr/candidates", label: "Candidates" },
                    { href: "/dashboard/hrm/hr/interviews", label: "Interviews" },
                    { href: "/dashboard/hrm/hr/offers", label: "Offers" },
                    { href: "/dashboard/hrm/hr/careers-page", label: "Careers Page" },
                ],
            },
            {
                label: 'People',
                subSubItems: [
                    { href: "/dashboard/hrm/hr/directory", label: "Employee Directory" },
                    { href: "/dashboard/hrm/hr/onboarding", label: "Onboarding" },
                    { href: "/dashboard/hrm/hr/welcome-kit", label: "Welcome Kits" },
                    { href: "/dashboard/hrm/hr/probation", label: "Probation Tracker" },
                    { href: "/dashboard/hrm/hr/org-chart", label: "Org Chart" },
                ],
            },
            {
                label: 'Employee Management',
                subSubItems: [
                    { href: "/dashboard/hrm/payroll/employees", label: "Employees" },
                    { href: "/dashboard/hrm/payroll/employees/new", label: "Add Employee" },
                    { href: "/dashboard/hrm/payroll/departments", label: "Departments" },
                    { href: "/dashboard/hrm/payroll/designations", label: "Designations" },
                ],
            },
            {
                label: 'Attendance & Leave',
                subSubItems: [
                    { href: "/dashboard/hrm/payroll/attendance", label: "Daily Attendance" },
                    { href: "/dashboard/hrm/payroll/leave", label: "Leave Management" },
                    { href: "/dashboard/hrm/payroll/holidays", label: "Holiday List" },
                ],
            },
            {
                label: 'Shifts & Time',
                subSubItems: [
                    { href: "/dashboard/hrm/payroll/shifts", label: "Shifts" },
                    { href: "/dashboard/hrm/payroll/shift-rotations", label: "Shift Rotations" },
                    { href: "/dashboard/hrm/payroll/shift-change-requests", label: "Shift Change Requests" },
                    { href: "/dashboard/hrm/payroll/time-logs", label: "Time Logs" },
                    { href: "/dashboard/hrm/payroll/weekly-timesheets", label: "Weekly Timesheets" },
                ],
            },
            {
                label: 'Payroll Management',
                subSubItems: [
                    { href: "/dashboard/hrm/payroll/payroll", label: "Generate Payroll" },
                    { href: "/dashboard/hrm/payroll/salary-structure", label: "Salary Structure" },
                    { href: "/dashboard/hrm/payroll/payslips", label: "Payslips" },
                ],
            },
            {
                label: 'Statutory Compliance',
                subSubItems: [
                    { href: "/dashboard/hrm/payroll/pf-esi", label: "PF / ESI Management" },
                    { href: "/dashboard/hrm/payroll/professional-tax", label: "Professional Tax" },
                    { href: "/dashboard/hrm/payroll/tds", label: "TDS" },
                    { href: "/dashboard/hrm/payroll/form-16", label: "Form 16" },
                ],
            },
            {
                label: 'Performance & Growth',
                subSubItems: [
                    { href: "/dashboard/hrm/payroll/goal-setting", label: "Goal Setting" },
                    { href: "/dashboard/hrm/payroll/kpi-tracking", label: "KPI Tracking" },
                    { href: "/dashboard/hrm/payroll/appraisal-reviews", label: "Appraisal Reviews" },
                    { href: "/dashboard/hrm/hr/okrs", label: "OKRs" },
                    { href: "/dashboard/hrm/hr/feedback-360", label: "360 Feedback" },
                    { href: "/dashboard/hrm/hr/one-on-ones", label: "One-on-Ones" },
                    { href: "/dashboard/hrm/hr/recognition", label: "Recognition" },
                    { href: "/dashboard/hrm/hr/awards", label: "Awards & Recognition" },
                    { href: "/dashboard/hrm/hr/surveys", label: "Surveys" },
                ],
            },
            {
                label: 'Learning',
                subSubItems: [
                    { href: "/dashboard/hrm/hr/training", label: "Training" },
                    { href: "/dashboard/hrm/hr/certifications", label: "Certifications" },
                    { href: "/dashboard/hrm/hr/learning-paths", label: "Learning Paths" },
                ],
            },
            {
                label: 'Docs & Assets',
                subSubItems: [
                    { href: "/dashboard/hrm/hr/documents", label: "Documents" },
                    { href: "/dashboard/hrm/hr/document-templates", label: "Document Templates" },
                    { href: "/dashboard/hrm/hr/assets", label: "Assets" },
                    { href: "/dashboard/hrm/hr/asset-assignments", label: "Asset Assignments" },
                ],
            },
            {
                label: 'Travel & Expenses',
                subSubItems: [
                    { href: "/dashboard/hrm/hr/timesheets", label: "Timesheets" },
                    { href: "/dashboard/hrm/hr/travel", label: "Travel" },
                    { href: "/dashboard/hrm/hr/expense-claims", label: "Expense Claims" },
                ],
            },
            {
                label: 'Exit & Comp',
                subSubItems: [
                    { href: "/dashboard/hrm/hr/exits", label: "Exits" },
                    { href: "/dashboard/hrm/hr/disciplinary", label: "Disciplinary Cases" },
                    { href: "/dashboard/hrm/hr/succession", label: "Succession" },
                    { href: "/dashboard/hrm/hr/compensation-bands", label: "Compensation Bands" },
                    { href: "/dashboard/hrm/hr/announcements", label: "Announcements" },
                    { href: "/dashboard/hrm/hr/policies", label: "Policies" },
                ],
            },
            {
                label: 'Reports',
                subSubItems: [
                    { href: "/dashboard/hrm/payroll/reports/attendance", label: "Attendance Report" },
                    { href: "/dashboard/hrm/payroll/reports/leave", label: "Leave Report" },
                    { href: "/dashboard/hrm/payroll/reports/payroll-summary", label: "Payroll Summary" },
                    { href: "/dashboard/hrm/payroll/reports/salary-register", label: "Salary Register" },
                ],
            },
            {
                label: 'Settings',
                subSubItems: [
                    { href: "/dashboard/hrm/payroll/settings", label: "All Settings" },
                ],
            },
        ],
    },
    {
        href: "/dashboard/sabbi/reports",
        label: "Reports",
        icon: FileText,
        subItems: [
            {
                label: 'GST',
                subSubItems: [
                    { href: "/dashboard/sabbi/reports/gstr-1", label: "GSTR-1 Sales Report" },
                    { href: "/dashboard/sabbi/reports/gstr-2b", label: "GSTR-2B Purchase Report" },
                ],
            },
            {
                label: 'Sales',
                subSubItems: [
                    { href: "/dashboard/sabbi/reports/top-clients", label: "Top Clients" },
                    { href: "/dashboard/sabbi/reports/top-products", label: "Top Products" },
                    { href: "/dashboard/sabbi/reports/sales-deals", label: "Sales Deals" },
                    { href: "/dashboard/sabbi/reports/invoice-aging", label: "Invoice Aging" },
                    { href: "/dashboard/sabbi/reports/payment-report", label: "Payment Report" },
                ],
            },
            {
                label: 'Operations',
                subSubItems: [
                    { href: "/dashboard/sabbi/reports/late-report", label: "Late Report" },
                    { href: "/dashboard/sabbi/reports/overdue-tasks", label: "Overdue Tasks" },
                    { href: "/dashboard/sabbi/reports/task-report", label: "Task Report" },
                    { href: "/dashboard/sabbi/reports/ticket-report", label: "Ticket Report" },
                    { href: "/dashboard/sabbi/reports/project-status-report", label: "Project Status" },
                    { href: "/dashboard/sabbi/reports/agent-performance", label: "Agent Performance" },
                ],
            },
            {
                label: 'HR',
                subSubItems: [
                    { href: "/dashboard/sabbi/reports/attendance-report", label: "Attendance" },
                    { href: "/dashboard/sabbi/reports/leave-report", label: "Leave" },
                    { href: "/dashboard/sabbi/reports/leave-balance-report", label: "Leave Balance" },
                    { href: "/dashboard/sabbi/reports/birthday-anniversary", label: "Birthday & Anniversary" },
                ],
            },
            {
                label: 'Finance',
                subSubItems: [
                    { href: "/dashboard/sabbi/reports/income", label: "Income" },
                    { href: "/dashboard/sabbi/reports/expense", label: "Expense" },
                    { href: "/dashboard/sabbi/reports/profit-loss", label: "Profit & Loss" },
                    { href: "/dashboard/sabbi/reports/tax", label: "Tax" },
                    { href: "/dashboard/sabbi/reports/leads-conversion", label: "Leads Conversion" },
                ],
            },
        ]
    },
    { href: "/dashboard/crm/integrations", label: "Integrations", icon: Zap },
    {
        href: "/dashboard/crm/settings",
        label: "CRM Settings",
        icon: Settings,
        subItems: [
            { href: "/dashboard/crm/settings", label: "All Settings" },
            { href: "/dashboard/crm/audit-log", label: "Audit Log" },
            { href: "/dashboard/crm/portal", label: "Customer Portal" },
        ],
    },
];

const teamMenuItems = [
    { href: "/dashboard/team/manage-users", label: "Manage Users", icon: UsersIcon },
    { href: "/dashboard/team/manage-roles", label: "Manage Roles", icon: ShieldCheck },
    { href: "/dashboard/team/team-chat", label: "Team Chat", icon: MessageSquare },
];

const sabChatMenuItems = [
    { href: '/dashboard/sabchat/inbox', label: 'Inbox', icon: Inbox },
    { href: '/dashboard/sabchat/visitors', label: 'Live Visitors', icon: Users },
    { href: '/dashboard/sabchat/analytics', label: 'Analytics', icon: BarChart },
    { href: '/dashboard/sabchat/widget', label: 'Widget Setup', icon: Wrench },
    { href: '/dashboard/sabchat/auto-reply', label: 'Auto Reply', icon: Bot },
    { href: '/dashboard/sabchat/quick-replies', label: 'Quick Replies', icon: LifeBuoy },
    { href: '/dashboard/sabchat/ai-replies', label: 'AI Replies', icon: Bot },
    { href: '/dashboard/sabchat/faq', label: 'FAQ', icon: HelpCircle },
    { href: '/dashboard/sabchat/settings', label: 'Settings', icon: Settings },
];

const facebookMenuGroups = [
    {
        title: 'General',
        items: [
            { href: '/dashboard/facebook/all-projects', label: 'Project Connections', icon: Wrench },
            { href: '/dashboard/facebook', label: 'Dashboard', icon: LayoutDashboard },
        ],
    },
    {
        title: 'Content',
        items: [
            { href: '/dashboard/facebook/posts', label: 'Posts', icon: Newspaper },
            { href: '/dashboard/facebook/scheduled', label: 'Scheduled', icon: Calendar },
            { href: '/dashboard/facebook/live-studio', label: 'Live Studio', icon: Video },
            { href: '/dashboard/facebook/post-randomizer', label: 'Post Randomizer', icon: Repeat },
        ],
    },
    {
        title: 'Engagement',
        items: [
            { href: '/dashboard/facebook/messages', label: 'Messages', icon: MessageSquare },
            { href: '/dashboard/facebook/kanban', label: 'Kanban Board', icon: FolderKanban },
            { href: '/dashboard/facebook/auto-reply', label: 'Automation', icon: Bot },
        ]
    },
    {
        title: 'Custom Shops',
        items: [
            { href: '/dashboard/facebook/custom-ecommerce', label: 'Shops Dashboard', icon: LayoutDashboard },
            { href: '/dashboard/facebook/custom-ecommerce/manage/[shopId]/website-builder', label: 'Website Builder', icon: Brush },
        ],
    },
    {
        title: 'Meta Commerce',
        items: [
            { href: '/dashboard/facebook/commerce/products', label: 'Products & Collections', icon: ShoppingBag },
            { href: '/dashboard/facebook/commerce/shop', label: 'Shop Setup', icon: LayoutDashboard },
            { href: '/dashboard/facebook/commerce/orders', label: 'Orders', icon: Package },
        ]
    },
    {
        title: 'Growth Tools',
        items: [
            { href: '/dashboard/facebook/ads', label: 'Ads Manager', icon: Megaphone },
            { href: '/dashboard/facebook/broadcasts', label: 'Broadcasts', icon: Send },
            { href: '/dashboard/facebook/subscribers', label: 'Subscribers', icon: Users },
        ]
    }
];

const instagramMenuGroups = [
    {
        title: 'General',
        items: [
            { href: '/dashboard/instagram/connections', label: 'Connections', icon: Wrench },
            { href: '/dashboard/instagram', label: 'Dashboard', icon: LayoutDashboard },
        ],
    },
    {
        title: 'Content',
        items: [
            { href: '/dashboard/instagram/feed', label: 'Feed', icon: Newspaper },
            { href: '/dashboard/instagram/stories', label: 'Stories', icon: Clapperboard },
            { href: '/dashboard/instagram/reels', label: 'Reels', icon: Video },
        ],
    },
    {
        title: 'Engagement',
        items: [
            { href: '/dashboard/instagram/messages', label: 'Messages', icon: MessageSquare },
        ]
    },
    {
        title: 'Growth',
        items: [
            { href: '/dashboard/instagram/discovery', label: 'Discovery', icon: Compass },
            { href: '/dashboard/instagram/hashtag-search', label: 'Hashtag Search', icon: Search },
        ]
    }
];

const emailMenuItems = [
    { href: '/dashboard/email', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/sabmail/inbox', label: 'Inbox', icon: Inbox },
    { href: '/dashboard/email/campaigns', label: 'Campaigns', icon: Send },
    { href: '/dashboard/email/contacts', label: 'Contacts', icon: Users },
    { href: '/dashboard/email/templates', label: 'Templates', icon: FileText },
    { href: '/dashboard/email/analytics', label: 'Analytics', icon: BarChart },
    { href: '/dashboard/email/verification', label: 'Verification', icon: ShieldCheck },
    { href: '/dashboard/email/settings', label: 'Settings', icon: Settings },
];

const smsMenuItems = [
    { href: '/sabsms', label: 'Overview', icon: LayoutGrid },
    { href: '/sabsms/inbox', label: 'Inbox', icon: MessageSquare },
    { href: '/sabsms/campaigns', label: 'Campaigns', icon: MessageSquare },
    { href: '/sabsms/templates', label: 'Templates', icon: FileText },
    { href: '/sabsms/numbers', label: 'Numbers', icon: Settings },
    { href: '/sabsms/providers', label: 'Providers', icon: Server },
    { href: '/sabsms/compliance', label: 'Compliance', icon: ShieldCheck },
    { href: '/sabsms/api-keys', label: 'Developer API', icon: Server },
];

const apiMenuItems = [
    { href: '/dashboard/api', label: 'API Keys', icon: Key },
    { href: '/dashboard/api/docs', label: 'API Docs', icon: BookCopy },
];

const urlShortenerMenuItems = [
    { href: '/dashboard/url-shortener', label: 'Shortener', icon: LinkIcon },
    { href: '/dashboard/url-shortener/settings', label: 'Settings', icon: Settings },
];

const qrCodeMakerMenuItems = [
    { href: '/dashboard/qr-code-maker', label: 'QR Maker', icon: QrCode },
    { href: '/dashboard/qr-code-maker/settings', label: 'Settings', icon: Settings },
];

const portfolioMenuItems = [
    { href: '/dashboard/website-builder', label: 'Websites', icon: LayoutDashboard },
];

const seoMenuItems = [
    { href: '/dashboard/seo', label: 'Dashboard', icon: TrendingUp },
    { href: '/dashboard/seo/tools', label: 'SEO Tools (117)', icon: Wrench },
    { href: '/dashboard/seo/brand-radar', label: 'Brand Radar', icon: Rss },
    { href: '/dashboard/seo/site-explorer', label: 'Site Explorer', icon: Globe },
];

const userSettingsItems = [
    { href: '/dashboard/user/settings/profile', label: 'Profile', icon: UserIcon },
    { href: '/dashboard/user/settings/ui', label: 'UI Preferences', icon: Brush },
    { href: '/dashboard/user/billing', label: 'Billing & Plans', icon: CreditCard },
];

const FullPageSkeleton = () => (
    <div className="flex h-screen w-screen bg-[var(--st-bg-secondary)] p-2 gap-2">
        <div className="w-16 rounded-lg bg-[var(--st-bg-secondary)] p-2"><Skeleton className="h-full w-full" /></div>
        <div className="w-60 rounded-lg bg-[var(--st-bg-secondary)] p-2"><Skeleton className="h-full w-full" /></div>
        <div className="flex-1 flex flex-col gap-2">
            <div className="h-16 rounded-lg bg-[var(--st-bg-secondary)] p-4"><Skeleton className="h-full w-full" /></div>
            <div className="flex-1 rounded-lg bg-[var(--st-bg-secondary)] p-4"><Skeleton className="h-full w-full" /></div>
        </div>
    </div>
);

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
    const {
        activeProject,
        activeProjectName,
        sessionUser,
    } = useProject();

    const pathname = usePathname();
    const [activeApp, setActiveApp] = React.useState('whatsapp');
    const [isSparklesEnabled, setIsSparklesEnabled] = React.useState(false);
    const appRailPosition = sessionUser?.appRailPosition || 'left';

    React.useEffect(() => {
        getDiwaliThemeStatus().then(status => setIsSparklesEnabled(status.enabled));

        let currentApp = 'whatsapp';
        if (pathname.startsWith('/dashboard/facebook')) { currentApp = 'facebook'; }
        else if (pathname.startsWith('/dashboard/instagram')) { currentApp = 'instagram'; }
        else if (pathname.startsWith('/dashboard/crm')) { currentApp = 'crm'; }
        else if (pathname.startsWith('/dashboard/team')) { currentApp = 'team'; }
        else if (pathname.startsWith('/dashboard/email')) { currentApp = 'email'; }
        else if (pathname.startsWith('/sabsms')) { currentApp = 'sabsms'; }
        else if (pathname.startsWith('/dashboard/api')) { currentApp = 'api'; }
        else if (pathname.startsWith('/dashboard/seo')) { currentApp = 'seo-suite'; }
        else if (pathname.startsWith('/dashboard/sabchat')) { currentApp = 'sabchat'; }
        else if (pathname.startsWith('/dashboard/website-builder') || pathname.startsWith('/dashboard/portfolio')) { currentApp = 'website-builder'; }
        else if (pathname.startsWith('/dashboard/url-shortener')) { currentApp = 'url-shortener'; }
        else if (pathname.startsWith('/dashboard/qr-code-maker')) { currentApp = 'qr-code-maker'; }
        else if (pathname.startsWith('/dashboard/user')) { currentApp = 'user-settings'; }
        else if (pathname.startsWith('/dashboard/settings')) { currentApp = 'whatsapp'; } // Treat Wachat settings as part of whatsapp
        setActiveApp(currentApp);
    }, [pathname]);

    const isChatPage = pathname.startsWith('/wachat/chat') || pathname.startsWith('/dashboard/facebook/messages') || pathname.startsWith('/dashboard/facebook/kanban') || pathname.startsWith('/dashboard/sabchat/inbox');
    const isWebsiteBuilderPage = pathname.includes('/builder');

    const currentUserRole = React.useMemo(() => {
        if (!sessionUser || !activeProject) return 'owner';
        if (sessionUser._id.toString() === activeProject.userId.toString()) return 'owner';
        const agentInfo = activeProject.agents?.find(a => a.userId.toString() === sessionUser._id.toString());
        return agentInfo?.role || 'none';
    }, [sessionUser, activeProject]);

    const appIcons = [
        { id: 'whatsapp', icon: WhatsAppIcon, label: 'Wachat', href: '/wachat' },
        { id: 'sabwa', icon: SabWaIcon, label: 'SabWa', href: '/sabwa' },
        { id: 'sabchat', icon: SabChatIcon, label: 'sabChat', href: '/dashboard/sabchat' },
        { id: 'facebook', href: '/dashboard/facebook/all-projects', icon: MetaIcon, label: 'Meta Suite' },
        { id: 'ad-manager', href: '/dashboard/ad-manager/ad-accounts', icon: Target, label: 'Ad Manager' },
        { id: 'telegram', href: '/dashboard/telegram', icon: TelegramIcon, label: 'Telegram' },
        { id: 'instagram', href: '/dashboard/instagram/connections', icon: InstagramIcon, label: 'Instagram' },
        { id: 'crm', href: '/dashboard/crm', icon: CrmIcon, label: 'CRM' },
        { id: 'sabflow', icon: Workflow, label: 'SabFlow', href: '/dashboard/sabflow' },
        { id: 'team', icon: UsersRound, label: 'Team', href: '/dashboard/team' },
        { id: 'email', icon: Mail, label: 'Email', href: '/dashboard/email' },
        { id: 'sabsms', icon: MessageSquareText, label: 'SabSMS', href: '/sabsms' },
        { id: 'api', icon: Server, label: 'API & Dev', href: '/dashboard/api' },
        { id: 'website-builder', icon: LayoutTemplate, label: 'Website', href: '/dashboard/website-builder' },
        { id: 'url-shortener', icon: LinkIcon, label: 'Links', href: '/dashboard/url-shortener' },
        { id: 'qr-code-maker', icon: QrCode, label: 'QR Codes', href: '/dashboard/qr-code-maker' },
        { id: 'seo-suite', icon: SeoIcon, label: 'SEO', href: '/dashboard/seo' },
    ];

    const mainContent = (
        <div className="p-4 md:p-6 lg:p-8">
            {children}
        </div>
    );

    const SidebarItem = ({ item, isSubItem = false }: { item: any; isSubItem?: boolean }) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const LinkIcon = item.icon;
        return (
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} className={cn(isSubItem && "pl-10")}>
                    <Link href={item.href}>{LinkIcon && <LinkIcon />}<span>{item.label}</span>{item.new && <Badge variant="warning" className="ml-auto">New</Badge>}</Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    }

    const CollapsibleSidebarItem = ({ item }: { item: any }) => {
        const isOpen = pathname.startsWith(item.href);
        return (
            <Collapsible defaultOpen={isOpen}>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isOpen} tooltip={item.label} className="w-full">
                        <item.icon /><span>{item.label}</span><ChevronRight className="ml-auto transition-transform group-data-[state=open]:rotate-90" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                    <SidebarMenu className="pl-4">
                        {item.subItems.map((subItem: any) =>
                            subItem.subSubItems ? (
                                <CollapsibleSidebarItem key={subItem.label} item={subItem} />
                            ) : (
                                <SidebarItem key={subItem.href} item={subItem} isSubItem={true} />
                            )
                        )}
                    </SidebarMenu>
                </CollapsibleContent>
            </Collapsible>
        )
    }

    const AppRail = () => (
        <Sidebar className="w-16 bg-sidebar-background border-sidebar-border">
            <SidebarHeader>
                <SabNodeLogo className="w-8 h-8" />
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    {appIcons.map(app => (
                        <SidebarMenuItem key={app.id}>
                            <SidebarMenuButton asChild isActive={activeApp === app.id} tooltip={app.label}>
                                <Link href={app.href} className="h-12"><app.icon /></Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="User Settings">
                            <Link href="/dashboard/user/settings">
                                <Settings className="h-4 w-4" />
                                <span className="sr-only">Settings</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );

    const HeaderAppRail = () => (
        <nav className="hidden items-center gap-1 md:flex">
            {appIcons.map(app => (
                <Button key={app.id} asChild variant={activeApp === app.id ? 'secondary' : 'ghost'} size="sm">
                    <Link href={app.href} className="flex items-center gap-2">
                        <app.icon className="h-4 w-4" />
                        {app.label}
                    </Link>
                </Button>
            ))}
        </nav>
    );

    return (
        <SidebarProvider>
            <div className={cn("admin-dashboard flex h-screen w-full flex-col bg-[var(--st-bg-muted)]/30", appRailPosition === 'top' ? 'app-rail-top' : 'app-rail-left')}>
                <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-[var(--st-bg-secondary)] px-4">
                    <div className="flex items-center gap-2">
                        <SidebarTrigger>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <PanelLeft />
                            </Button>
                        </SidebarTrigger>
                        <Link href="/wachat" className="hidden font-bold sm:inline-block">
                            SabNode
                        </Link>
                        {appRailPosition === 'top' && (
                            <>
                                <Separator orientation="vertical" className="h-6 mx-2 hidden md:block" />
                                <HeaderAppRail />
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="font-medium text-sm hidden md:block">{activeProjectName}</div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                    <Avatar>
                                        <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704d" data-ai-hint="person avatar" />
                                        <AvatarFallback>{sessionUser?.name.charAt(0) || 'U'}</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild><Link href="/dashboard/user/settings/profile">Profile</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href="/dashboard/user/billing">Billing</Link></DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild><Link href="/api/auth/admin-logout" prefetch={false}><LogOut className="mr-2 h-4 w-4" />Admin Logout</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href="/api/auth/logout" prefetch={false}><LogOut className="mr-2 h-4 w-4" />Logout</Link></DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    {appRailPosition === 'left' && <AppRail />}
                    <Sidebar className="hidden md:flex">
                        <SidebarHeader>
                            {/* Can be used for project switcher */}
                        </SidebarHeader>
                        <SidebarContent>
                            {activeApp === 'whatsapp' && (
                                <SidebarMenu>
                                    {wachatMenuItems.filter(item => item.roles.includes(currentUserRole) && !item.href.includes('[')).map((item) => (
                                        <SidebarItem key={item.href} item={item} />
                                    ))}
                                </SidebarMenu>
                            )}
                            {activeApp === 'sabchat' && (
                                <SidebarMenu>
                                    {sabChatMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                                </SidebarMenu>
                            )}
                            {activeApp === 'facebook' && (
                                <SidebarMenu>
                                    {facebookMenuGroups.map(group => (
                                        <React.Fragment key={group.title}>
                                            <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mt-4 mb-1">{group.title}</p>
                                            {group.items.filter(item => !item.href.includes('[')).map(item => (
                                                <SidebarItem key={item.href} item={item} />
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </SidebarMenu>
                            )}
                            {activeApp === 'instagram' && (
                                <SidebarMenu>
                                    {instagramMenuGroups.flatMap(g => g.items).filter(item => !item.href.includes('[')).map(item => (
                                        <SidebarItem key={item.href} item={item} />
                                    ))}
                                </SidebarMenu>
                            )}
                            {activeApp === 'crm' && (
                                <SidebarMenu>
                                    {crmMenuItems.map(item => item.subItems ? <CollapsibleSidebarItem key={item.href} item={item} /> : <SidebarItem key={item.href} item={item} />)}
                                </SidebarMenu>
                            )}
                            {activeApp === 'team' && (
                                <SidebarMenu>
                                    {teamMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                                </SidebarMenu>
                            )}
                            {activeApp === 'email' && (
                                <SidebarMenu>
                                    {emailMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                                </SidebarMenu>
                            )}
                            {activeApp === 'sabsms' && (
                                <SidebarMenu>
                                    {smsMenuItems.map((item: any) => (item as any).subItems ? <CollapsibleSidebarItem key={item.href} item={item} /> : <SidebarItem key={item.href} item={item} />)}
                                </SidebarMenu>
                            )}
                            {activeApp === 'api' && (
                                <SidebarMenu>
                                    {apiMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                                </SidebarMenu>
                            )}
                            {activeApp === 'website-builder' && (
                                <SidebarMenu>
                                    {portfolioMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                                </SidebarMenu>
                            )}
                            {activeApp === 'url-shortener' && (
                                <SidebarMenu>
                                    {urlShortenerMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                                </SidebarMenu>
                            )}
                            {activeApp === 'qr-code-maker' && (
                                <SidebarMenu>
                                    {qrCodeMakerMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                                </SidebarMenu>
                            )}
                            {activeApp === 'seo-suite' && (
                                <SidebarMenu>
                                    {seoMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                                </SidebarMenu>
                            )}
                            {activeApp === 'user-settings' && (
                                <SidebarMenu>
                                    {userSettingsItems.map(item => <SidebarItem key={item.href} item={item} />)}
                                </SidebarMenu>
                            )}
                        </SidebarContent>
                    </Sidebar>
                    <main className="flex-1 overflow-y-auto">
                        {isChatPage || isWebsiteBuilderPage ? children : mainContent}
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}

// This is the main exported component
export function DashboardClientLayout({ children }: { children: React.ReactNode }) {
    const [isClient, setIsClient] = React.useState(false);
    const [initialData, setInitialData] = React.useState<{ user: any, projects: any[] } | null>(null);
    const router = useRouter();

    React.useEffect(() => {
        setIsClient(true);
        const fetchInitial = async () => {
            try {
                const session = await getSession();
                if (!session?.user) {
                    router.push('/login');
                    return;
                }
                const { projects } = (await getProjects() as any) || { projects: [] };
                setInitialData({ user: session.user, projects });
            } catch (error) {
                console.error("Initialization failed:", error);
                router.push('/login');
            }
        };
        fetchInitial();
    }, [router]);

    if (!isClient || !initialData) {
        return <FullPageSkeleton />;
    }

    return (
        <ProjectProvider initialProjects={initialData.projects} user={initialData.user}>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </ProjectProvider>
    );
}