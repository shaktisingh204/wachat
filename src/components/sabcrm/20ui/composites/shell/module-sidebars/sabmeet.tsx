"use client";

import { Film, Home, ListChecks, Plus, Video } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABMEET_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabmeet",
  heading: "SabMeet",
  caption: "Video meetings",
  build: (p) => [
    {
      id: "meet-meetings",
      label: "Meetings",
      items: [
        leaf("overview", "Overview", "/dashboard/sabmeet", Home, p, { exact: true }),
        leaf("new", "New meeting", "/dashboard/sabmeet/new", Plus, p),
        leaf("rooms", "Meeting rooms", "/dashboard/sabmeet/rooms", Video, p),
      ],
    },
    {
      id: "meet-engagement",
      label: "Engagement",
      items: [
        leaf("recordings", "Recordings", "/dashboard/sabmeet/recordings", Film, p),
        leaf("polls", "Polls", "/dashboard/sabmeet/polls", ListChecks, p),
      ],
    },
  ],
};
