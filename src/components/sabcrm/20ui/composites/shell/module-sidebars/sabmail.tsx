"use client";

import { Inbox, Mail } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABMAIL_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabmail",
  heading: "SabMail",
  caption: "Email workspace",
  build: (p) => [
    {
      id: "mail-main",
      label: "Mail",
      items: [
        leaf("inbox", "Inbox", "/dashboard/sabmail/inbox", Inbox, p),
        leaf("crm-email", "CRM email", "/dashboard/sabmail/crm-email", Mail, p),
      ],
    },
  ],
};
