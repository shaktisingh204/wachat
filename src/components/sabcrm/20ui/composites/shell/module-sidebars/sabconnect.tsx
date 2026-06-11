"use client";

import {
  BookOpen,
  Contact,
  LayoutGrid,
  Megaphone,
  Newspaper,
  Plus,
  Users,
} from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABCONNECT_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabconnect",
  heading: "SabConnect",
  caption: "Company intranet & social",
  build: (p) => [
    {
      id: "sc-community",
      label: "Community",
      items: [
        leaf("feed", "Feed", "/dashboard/sabconnect/feed", Newspaper, p),
        leaf("groups", "Groups", "/dashboard/sabconnect/groups", Users, p),
        leaf("people", "People", "/dashboard/sabconnect/people", Contact, p),
      ],
    },
    {
      id: "sc-comms",
      label: "Comms & resources",
      items: [
        leaf("announcements", "Announcements", "/dashboard/sabconnect/announcements", Megaphone, p, { exact: true }),
        leaf("announcement-new", "New announcement", "/dashboard/sabconnect/announcements/new", Plus, p),
        leaf("manuals", "Manuals", "/dashboard/sabconnect/manuals", BookOpen, p),
        leaf("apps", "Apps", "/dashboard/sabconnect/apps", LayoutGrid, p),
      ],
    },
  ],
};
