"use client";

/**
 * SabCheckout sidebar — payment pages, billing & checkout operations.
 *
 * Every href maps to a real `page.tsx` under
 * `src/app/dashboard/sabcheckout`. The `[pageId]` editor route doubles
 * as the create flow when `pageId === "new"`, which is why "New page"
 * points at `/dashboard/sabcheckout/new`.
 */

import {
  Activity,
  ArrowUpRight,
  Banknote,
  BarChart3,
  BellRing,
  Boxes,
  Briefcase,
  CalendarClock,
  ClipboardList,
  Coins,
  CreditCard,
  FileMinus,
  FileText,
  Fingerprint,
  FlaskConical,
  Gauge,
  Gift,
  Globe,
  Heart,
  Home,
  Key,
  KeyRound,
  Layers,
  Link2,
  Package,
  Plus,
  PlusCircle,
  Puzzle,
  Radio,
  Receipt,
  Repeat,
  Settings,
  Shield,
  ShieldAlert,
  ShoppingCart,
  Ticket,
  TrendingDown,
  TrendingUp,
  Truck,
  UserCircle,
  Users,
  Wallet,
  Webhook,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABCHECKOUT_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabcheckout",
  heading: "SabCheckout",
  caption: "Payment pages & billing",
  build: (p) => [
    {
      id: "sc-overview",
      label: "Overview",
      items: [
        leaf("home", "Overview", "/dashboard/sabcheckout", Home, p, { exact: true }),
        leaf("live", "Live", "/dashboard/sabcheckout/live", Radio, p),
        leaf("sessions", "Sessions", "/dashboard/sabcheckout/sessions", Activity, p),
        leaf("analytics", "Analytics", "/dashboard/sabcheckout/analytics", BarChart3, p),
        leaf("mrr", "MRR report", "/dashboard/sabcheckout/reports/mrr", TrendingUp, p),
        leaf("churn", "Churn report", "/dashboard/sabcheckout/reports/churn", TrendingDown, p),
      ],
    },
    {
      id: "sc-pages",
      label: "Payment pages",
      items: [
        leaf("new-page", "New page", "/dashboard/sabcheckout/new", Plus, p),
        leaf("links", "Payment links", "/dashboard/sabcheckout/links", Link2, p),
        leaf("domains", "Custom domains", "/dashboard/sabcheckout/custom-domains", Globe, p),
        leaf("ab-testing", "A/B testing", "/dashboard/sabcheckout/ab-testing", FlaskConical, p),
        leaf("portal", "Customer portal", "/dashboard/sabcheckout/customer-portal", UserCircle, p),
      ],
    },
    {
      id: "sc-catalog",
      label: "Catalog & pricing",
      items: [
        leaf("products", "Products", "/dashboard/sabcheckout/products", Package, p),
        leaf("plans", "Plans", "/dashboard/sabcheckout/plans", ClipboardList, p),
        leaf("tiered", "Tiered pricing", "/dashboard/sabcheckout/tiered-pricing", Layers, p),
        leaf("inventory", "Inventory", "/dashboard/sabcheckout/inventory", Boxes, p),
        leaf("preorders", "Preorders", "/dashboard/sabcheckout/preorders", CalendarClock, p),
        leaf("order-bumps", "Order bumps", "/dashboard/sabcheckout/order-bumps", PlusCircle, p),
        leaf("upsells", "Upsells", "/dashboard/sabcheckout/upsells", ArrowUpRight, p),
      ],
    },
    {
      id: "sc-billing",
      label: "Billing",
      items: [
        leaf("subscriptions", "Subscriptions", "/dashboard/sabcheckout/subscriptions", Repeat, p),
        leaf("metered", "Metered billing", "/dashboard/sabcheckout/metered-billing", Gauge, p),
        leaf("invoices", "Invoices", "/dashboard/sabcheckout/invoices", FileText, p),
        leaf("dunning", "Dunning", "/dashboard/sabcheckout/dunning", BellRing, p),
        leaf("multi-currency", "Multi-currency", "/dashboard/sabcheckout/multi-currency", Coins, p),
        leaf("taxes", "Taxes", "/dashboard/sabcheckout/taxes", Receipt, p),
        leaf("tax-exemptions", "Tax exemptions", "/dashboard/sabcheckout/tax-exemptions", FileMinus, p),
      ],
    },
    {
      id: "sc-customers",
      label: "Customers & growth",
      items: [
        leaf("customers", "Customers", "/dashboard/sabcheckout/customers", Users, p),
        leaf("coupons", "Coupons", "/dashboard/sabcheckout/coupons", Ticket, p),
        leaf("gift-cards", "Gift cards", "/dashboard/sabcheckout/gift-cards", Gift, p),
        leaf("store-credit", "Store credit", "/dashboard/sabcheckout/store-credit", Wallet, p),
        leaf("loyalty", "Loyalty", "/dashboard/sabcheckout/loyalty", Heart, p),
        leaf("abandoned", "Abandoned carts", "/dashboard/sabcheckout/abandoned", ShoppingCart, p),
        leaf("affiliates", "Affiliates", "/dashboard/sabcheckout/affiliates", Users, p),
        leaf("reseller", "Reseller", "/dashboard/sabcheckout/reseller", Briefcase, p),
      ],
    },
    {
      id: "sc-payments",
      label: "Payments & risk",
      items: [
        leaf("gateways", "Payment gateways", "/dashboard/sabcheckout/payment-gateways", CreditCard, p),
        leaf("payouts", "Payouts", "/dashboard/sabcheckout/payouts", Banknote, p),
        leaf("disputes", "Disputes", "/dashboard/sabcheckout/disputes", ShieldAlert, p),
        leaf("fraud", "Fraud prevention", "/dashboard/sabcheckout/fraud-prevention", Shield, p),
      ],
    },
    {
      id: "sc-fulfillment",
      label: "Fulfillment",
      items: [
        leaf("fulfillment", "Fulfillment", "/dashboard/sabcheckout/fulfillment", Truck, p),
        leaf("license-keys", "License keys", "/dashboard/sabcheckout/license-keys", Key, p),
        leaf("watermarking", "Digital watermarking", "/dashboard/sabcheckout/digital-watermarking", Fingerprint, p),
      ],
    },
    {
      id: "sc-dev",
      label: "Developer & settings",
      items: [
        leaf("integrations", "Integrations", "/dashboard/sabcheckout/integrations", Puzzle, p),
        leaf("api-keys", "API keys", "/dashboard/sabcheckout/api-keys", KeyRound, p),
        leaf("webhooks", "Webhooks", "/dashboard/sabcheckout/webhooks", Webhook, p),
        leaf("settings", "Settings", "/dashboard/sabcheckout/settings", Settings, p),
      ],
    },
  ],
};
