"use client";

import {
  Activity,
  AppWindow,
  Banknote,
  Crosshair,
  Eye,
  FileCheck,
  FlaskConical,
  Flame,
  Gavel,
  Globe,
  Handshake,
  Home,
  ImageIcon,
  LayoutGrid,
  Link2,
  ListVideo,
  Megaphone,
  MousePointerClick,
  Newspaper,
  PieChart,
  Receipt,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  TextCursorInput,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

/**
 * Literal top-level segments under /dashboard/sabsense that are NOT a
 * [siteId]. Anything else in that position is treated as a site id and
 * switches the sidebar into per-site mode.
 */
const NON_SITE_SEGMENTS = new Set([
  "ab-testing",
  "ad-units",
  "advertiser-billing",
  "advertisers",
  "analytics",
  "apps",
  "bidding",
  "brand-safety",
  "budgeting",
  "campaigns",
  "consent-mgmt",
  "creatives",
  "direct-deals",
  "floor-pricing",
  "fraud-detection",
  "native-ads",
  "payouts",
  "placements",
  "publishers",
  "revenue-share",
  "sites",
  "targeting",
  "tax-forms",
  "utm-tracking",
  "viewability",
  "yield-mgmt",
]);

function siteIdFromPath(pathname: string): string | null {
  const match = /^\/dashboard\/sabsense\/([^/]+)/.exec(pathname);
  if (!match) return null;
  const segment = decodeURIComponent(match[1]);
  return NON_SITE_SEGMENTS.has(segment) ? null : segment;
}

export const SABSENSE_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabsense",
  heading: "SabSense",
  caption: "Web analytics & ads",
  build: (p) => {
    const siteId = siteIdFromPath(p);

    if (siteId) {
      const base = `/dashboard/sabsense/${siteId}`;
      return [
        {
          id: "sabsense-sites",
          label: "Sites",
          items: [
            leaf("all-sites", "All sites", "/dashboard/sabsense", Globe, p, { exact: true }),
          ],
        },
        {
          id: "sabsense-site",
          label: "Site analytics",
          items: [
            leaf("heatmaps", "Heatmaps", `${base}/heatmaps`, Flame, p),
            leaf("scroll", "Scroll", `${base}/scroll`, MousePointerClick, p),
            leaf("funnels", "Funnels", `${base}/funnels`, PieChart, p),
            leaf("recordings", "Recordings", `${base}/recordings`, ListVideo, p),
            leaf("forms", "Forms", `${base}/forms`, TextCursorInput, p),
          ],
        },
      ];
    }

    return [
      {
        id: "sabsense-analytics",
        label: "Web analytics",
        items: [
          leaf("all-sites", "All sites", "/dashboard/sabsense", Home, p, { exact: true }),
          leaf("sites", "Sites", "/dashboard/sabsense/sites", Globe, p),
          leaf("analytics", "Analytics", "/dashboard/sabsense/analytics", Activity, p),
          leaf("utm-tracking", "UTM tracking", "/dashboard/sabsense/utm-tracking", Link2, p),
          leaf("ab-testing", "A/B testing", "/dashboard/sabsense/ab-testing", FlaskConical, p),
        ],
      },
      {
        id: "sabsense-advertisers",
        label: "Advertisers",
        items: [
          leaf("advertisers", "Advertisers", "/dashboard/sabsense/advertisers", Users, p),
          leaf("campaigns", "Campaigns", "/dashboard/sabsense/campaigns", Megaphone, p),
          leaf("creatives", "Creatives", "/dashboard/sabsense/creatives", ImageIcon, p),
          leaf("targeting", "Targeting", "/dashboard/sabsense/targeting", Target, p),
          leaf("budgeting", "Budgeting", "/dashboard/sabsense/budgeting", Wallet, p),
          leaf("advertiser-billing", "Billing", "/dashboard/sabsense/advertiser-billing", Receipt, p),
        ],
      },
      {
        id: "sabsense-inventory",
        label: "Inventory & yield",
        items: [
          leaf("ad-units", "Ad units", "/dashboard/sabsense/ad-units", LayoutGrid, p),
          leaf("placements", "Placements", "/dashboard/sabsense/placements", Crosshair, p),
          leaf("native-ads", "Native ads", "/dashboard/sabsense/native-ads", Newspaper, p),
          leaf("direct-deals", "Direct deals", "/dashboard/sabsense/direct-deals", Handshake, p),
          leaf("bidding", "Bidding", "/dashboard/sabsense/bidding", Gavel, p),
          leaf("floor-pricing", "Floor pricing", "/dashboard/sabsense/floor-pricing", Scale, p),
          leaf("yield-mgmt", "Yield management", "/dashboard/sabsense/yield-mgmt", TrendingUp, p),
          leaf("viewability", "Viewability", "/dashboard/sabsense/viewability", Eye, p),
        ],
      },
      {
        id: "sabsense-publishers",
        label: "Publishers",
        items: [
          leaf("publishers", "Publishers", "/dashboard/sabsense/publishers", Sparkles, p),
          leaf("apps", "Apps", "/dashboard/sabsense/apps", AppWindow, p),
          leaf("revenue-share", "Revenue share", "/dashboard/sabsense/revenue-share", PieChart, p),
          leaf("payouts", "Payouts", "/dashboard/sabsense/payouts", Banknote, p),
          leaf("tax-forms", "Tax forms", "/dashboard/sabsense/tax-forms", FileCheck, p),
        ],
      },
      {
        id: "sabsense-trust",
        label: "Trust & compliance",
        items: [
          leaf("brand-safety", "Brand safety", "/dashboard/sabsense/brand-safety", ShieldCheck, p),
          leaf("fraud-detection", "Fraud detection", "/dashboard/sabsense/fraud-detection", ShieldAlert, p),
          leaf("consent-mgmt", "Consent management", "/dashboard/sabsense/consent-mgmt", FileCheck, p),
        ],
      },
    ];
  },
};
