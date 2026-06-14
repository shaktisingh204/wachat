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
  prefix: "/sabsign",
  heading: "SabSign",
  caption: "E-signatures & envelopes",
  build: (p) => [
    {
      id: "sign-envelopes",
      label: "Envelopes",
      items: [
        leaf("envelopes", "Envelopes", "/sabsign", FileSignature, p, { exact: true }),
        leaf("new", "New envelope", "/sabsign/new", Plus, p),
        leaf("bulk", "Bulk send", "/sabsign/bulk", Send, p),
        leaf("templates", "Templates", "/sabsign/templates", Layers, p),
      ],
    },
    {
      id: "sign-documents",
      label: "Documents",
      items: [
        leaf("docs", "Documents", "/sabsign/docs", FileText, p),
        leaf("doc-templates", "Document templates", "/sabsign/docs/templates", Files, p),
        leaf("form-builder", "Form builder", "/sabsign/form-builder", ClipboardList, p),
      ],
    },
    {
      id: "sign-people",
      label: "People & compliance",
      items: [
        leaf("contacts", "Address book", "/sabsign/contacts", Users, p),
        leaf("notary", "Notary", "/sabsign/notary", Stamp, p),
        leaf("audit", "Audit log", "/sabsign/audit", History, p),
      ],
    },
    {
      id: "sign-workspace",
      label: "Workspace",
      items: [
        leaf("reports", "Reports", "/sabsign/reports", BarChart3, p),
        leaf("integrations", "Integrations", "/sabsign/integrations", Puzzle, p),
        leaf("api", "Developer API", "/sabsign/api", Code2, p),
        leaf("billing", "Billing", "/sabsign/billing", CreditCard, p),
        leaf("settings", "Settings", "/sabsign/settings", Settings, p),
      ],
    },
  ],
};
