"use client";

/**
 * SabShop sidebar — tenant-scoped storefronts.
 *
 * All feature routes live under `/dashboard/sabshop/[storefrontId]/…`,
 * so `build` parses the storefront id from the pathname and only emits
 * the scoped groups while inside a storefront. The picker group
 * ("All storefronts" / "New storefront") is always present. `new` is a
 * static sibling route, never a storefront id.
 */

import {
  ArrowLeftRight,
  Activity,
  BadgePercent,
  Briefcase,
  ClipboardList,
  Factory,
  Filter,
  Gift,
  Globe,
  Heart,
  Home,
  Layers,
  MapPin,
  Monitor,
  Package,
  Palette,
  PieChart,
  Plus,
  PlusCircle,
  Receipt,
  Settings,
  ShoppingCart,
  Star,
  Store,
  Truck,
  Users,
  Webhook,
  Zap,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABSHOP_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabshop",
  heading: "SabShop",
  caption: "Multi-storefront commerce",
  build: (p) => {
    const match = p.match(/^\/dashboard\/sabshop\/([^/]+)/);
    const id = match && match[1] !== "new" ? match[1] : null;

    const picker = {
      id: "shop-storefronts",
      label: "Storefronts",
      items: [
        leaf("all", "All storefronts", "/dashboard/sabshop", Store, p, { exact: true }),
        leaf("new", "New storefront", "/dashboard/sabshop/new", Plus, p),
      ],
    };

    if (!id) return [picker];

    const base = `/dashboard/sabshop/${id}`;
    return [
      picker,
      {
        id: "shop-store",
        label: "Store",
        items: [
          leaf("overview", "Overview", base, Home, p, { exact: true }),
          leaf("themes", "Themes", `${base}/themes`, Palette, p),
          leaf("settings", "Settings", `${base}/settings`, Settings, p),
        ],
      },
      {
        id: "shop-catalog",
        label: "Catalog",
        items: [
          leaf("products", "Products", `${base}/products`, Package, p),
          leaf("product-new", "New product", `${base}/products/new`, PlusCircle, p),
          leaf("collections", "Collections", `${base}/collections`, Layers, p),
        ],
      },
      {
        id: "shop-orders",
        label: "Orders & inventory",
        items: [
          leaf("orders", "Orders", `${base}/orders`, ShoppingCart, p),
          leaf("shipping", "Shipping", `${base}/shipping`, Truck, p),
          leaf("taxes", "Taxes", `${base}/taxes`, Receipt, p),
          leaf("locations", "Locations", `${base}/inventory/locations`, MapPin, p),
          leaf("purchase-orders", "Purchase orders", `${base}/inventory/purchase-orders`, ClipboardList, p),
          leaf("suppliers", "Suppliers", `${base}/inventory/suppliers`, Factory, p),
          leaf("transfers", "Transfers", `${base}/inventory/transfers`, ArrowLeftRight, p),
        ],
      },
      {
        id: "shop-customers",
        label: "Customers",
        items: [
          leaf("segments", "Segments", `${base}/customers/segments`, Users, p),
          leaf("loyalty", "Loyalty", `${base}/customers/loyalty`, Heart, p),
          leaf("reviews", "Reviews", `${base}/customers/reviews`, Star, p),
        ],
      },
      {
        id: "shop-marketing",
        label: "Marketing",
        items: [
          leaf("discounts", "Discounts", `${base}/discounts`, BadgePercent, p),
          leaf("gift-cards", "Gift cards", `${base}/gift-cards`, Gift, p),
          leaf("automations", "Automations", `${base}/automations`, Zap, p),
        ],
      },
      {
        id: "shop-channels",
        label: "Channels",
        items: [
          leaf("pos", "POS", `${base}/channels/pos`, Monitor, p),
          leaf("marketplaces", "Marketplaces", `${base}/channels/marketplaces`, Globe, p),
          leaf("b2b", "B2B", `${base}/channels/b2b`, Briefcase, p),
        ],
      },
      {
        id: "shop-analytics",
        label: "Analytics & dev",
        items: [
          leaf("live", "Live view", `${base}/analytics/live`, Activity, p),
          leaf("funnels", "Funnels", `${base}/analytics/funnels`, Filter, p),
          leaf("cohorts", "Cohorts", `${base}/analytics/cohorts`, PieChart, p),
          leaf("webhooks", "Webhooks", `${base}/webhooks`, Webhook, p),
        ],
      },
    ];
  },
};
