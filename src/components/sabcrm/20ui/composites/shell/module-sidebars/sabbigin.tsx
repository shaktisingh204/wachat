"use client";

import {
  Calendar,
  Contact,
  GaugeCircle,
  Layers,
  Mail,
  Package,
  Phone,
  Plus,
  Workflow,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

/**
 * SabBigin (lite CRM SKU) sidebar. Mirrors the retired `SabbiginNav`
 * top-strip (`_components/sabbigin-shell.tsx`) — the whole point of
 * SabBigin is a narrower surface than the full Sales CRM module, so
 * keep this list short.
 */
export const SABBIGIN_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabbigin",
  heading: "SabBigin",
  caption: "Lite CRM",
  build: (p) => [
    {
      id: "sabbigin-overview",
      label: "Overview",
      items: [
        leaf("home", "Home", "/dashboard/sabbigin", GaugeCircle, p, { exact: true }),
        leaf("dashboard", "Dashboard", "/dashboard/sabbigin/dashboard", Calendar, p),
      ],
    },
    {
      id: "sabbigin-sales",
      label: "Sales",
      items: [
        leaf("pipeline", "Pipeline board", "/dashboard/sabbigin/pipeline", Layers, p),
        leaf("pipelines", "Pipelines", "/dashboard/sabbigin/pipelines", Workflow, p),
        leaf("pipelines-new", "New pipeline", "/dashboard/sabbigin/pipelines/new", Plus, p),
        leaf("products", "Products", "/dashboard/sabbigin/products", Package, p),
      ],
    },
    {
      id: "sabbigin-contacts",
      label: "Contacts & activity",
      items: [
        leaf("contacts", "Contacts", "/dashboard/sabbigin/contacts", Contact, p),
        leaf("contacts-new", "New contact", "/dashboard/sabbigin/contacts/new", Plus, p),
        leaf("calls", "Calls", "/dashboard/sabbigin/calls", Phone, p),
        leaf("emails", "Emails", "/dashboard/sabbigin/emails", Mail, p),
      ],
    },
  ],
};
