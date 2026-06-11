"use client";

import { Home, MapPin, Plus } from "lucide-react";

import { leaf, type SabAppSidebarConfig } from "./_shared";

export const SABPUBLISH_SIDEBAR: SabAppSidebarConfig = {
  prefix: "/dashboard/sabpublish",
  heading: "SabPublish",
  caption: "Local listings & reviews",
  build: (p) => [
    {
      id: "pub-listings",
      label: "Listings",
      items: [
        leaf("overview", "Overview", "/dashboard/sabpublish", Home, p, { exact: true }),
        leaf("locations", "Locations", "/dashboard/sabpublish/locations", MapPin, p, { exact: true }),
        leaf("location-new", "Add location", "/dashboard/sabpublish/locations/new", Plus, p),
      ],
    },
  ],
};
