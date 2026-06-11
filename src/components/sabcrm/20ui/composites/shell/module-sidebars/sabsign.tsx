"use client";

import {
  BarChart3,
  ClipboardList,
  Code2,
  CreditCard,
  Files,
  FileSignature,
  FileText,
  History,
  Layers,
  Plus,
  Puzzle,
  Send,
  Settings,
  Stamp,
  Users,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABSIGN_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabsign",
  heading: "SabSign",
  caption: "E-signatures & envelopes",
  build: (p) => [
    {
      id: "sign-envelopes",
      label: "Envelopes",
      items: [
        leaf("envelopes", "Envelopes", "/dashboard/sabsign", FileSignature, p, { exact: true }),
        leaf("new", "New envelope", "/dashboard/sabsign/new", Plus, p),
        leaf("bulk", "Bulk send", "/dashboard/sabsign/bulk", Send, p),
        leaf("templates", "Templates", "/dashboard/sabsign/templates", Layers, p),
      ],
    },
    {
      id: "sign-documents",
      label: "Documents",
      items: [
        leaf("docs", "Documents", "/dashboard/sabsign/docs", FileText, p),
        leaf("doc-templates", "Document templates", "/dashboard/sabsign/docs/templates", Files, p),
        leaf("form-builder", "Form builder", "/dashboard/sabsign/form-builder", ClipboardList, p),
      ],
    },
    {
      id: "sign-people",
      label: "People & compliance",
      items: [
        leaf("contacts", "Address book", "/dashboard/sabsign/contacts", Users, p),
        leaf("notary", "Notary", "/dashboard/sabsign/notary", Stamp, p),
        leaf("audit", "Audit log", "/dashboard/sabsign/audit", History, p),
      ],
    },
    {
      id: "sign-workspace",
      label: "Workspace",
      items: [
        leaf("reports", "Reports", "/dashboard/sabsign/reports", BarChart3, p),
        leaf("integrations", "Integrations", "/dashboard/sabsign/integrations", Puzzle, p),
        leaf("api", "Developer API", "/dashboard/sabsign/api", Code2, p),
        leaf("billing", "Billing", "/dashboard/sabsign/billing", CreditCard, p),
        leaf("settings", "Settings", "/dashboard/sabsign/settings", Settings, p),
      ],
    },
  ],
};
