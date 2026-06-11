"use client";

import {
  BarChart3,
  BookOpen,
  Boxes,
  FileSearch,
  Key,
  KeyRound,
  Terminal,
  Webhook,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const API_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/api",
  heading: "API Platform",
  caption: "Developer platform",
  build: (p) => [
    {
      id: "api-platform",
      label: "Platform",
      items: [
        leaf("overview", "Overview", "/dashboard/api", Terminal, p, { exact: true }),
        leaf("usage", "Usage", "/dashboard/api/usage", BarChart3, p),
        leaf("logs", "Request logs", "/dashboard/api/logs", FileSearch, p),
        leaf("docs", "API reference", "/dashboard/api/docs", BookOpen, p),
      ],
    },
    {
      id: "api-credentials",
      label: "Credentials",
      items: [
        leaf("keys", "API keys", "/dashboard/api/keys", KeyRound, p),
        leaf("personal-tokens", "Personal tokens", "/dashboard/api/personal-tokens", Key, p),
        leaf("apps", "OAuth apps", "/dashboard/api/apps", Boxes, p),
        leaf("webhooks", "Webhooks", "/dashboard/api/webhooks", Webhook, p),
      ],
    },
  ],
};
