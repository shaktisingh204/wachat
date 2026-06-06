"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ZoruShell } from '@/components/sabcrm/20ui/compat';
import { ZoruAppSidebar, SidebarGroup } from '@/components/sabcrm/20ui/compat';
import { Sparkles, Layout, Palette, ToggleLeft, FormInput, GalleryHorizontalEnd, ArrowUpRight, Monitor, Layers } from "lucide-react";

export function ZoruGalleryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const groups: SidebarGroup[] = [
    {
      id: "overview",
      items: [
        {
          id: "index",
          label: "Overview",
          href: "/zoruui",
          icon: <Sparkles />,
          active: pathname === "/zoruui",
        },
      ],
    },
    {
      id: "components",
      label: "Components",
      items: [
        {
          id: "buttons",
          label: "Buttons",
          href: "/zoruui/buttons",
          icon: <ToggleLeft />,
          active: pathname === "/zoruui/buttons",
        },
        {
          id: "forms",
          label: "Forms & Inputs",
          href: "/zoruui/forms",
          icon: <FormInput />,
          active: pathname === "/zoruui/forms",
        },
        {
          id: "cards",
          label: "Cards",
          href: "/zoruui/cards",
          icon: <GalleryHorizontalEnd />,
          active: pathname === "/zoruui/cards",
        },
        {
          id: "overlays",
          label: "Overlays",
          href: "/zoruui/overlays",
          icon: <Layers />,
          active: pathname === "/zoruui/overlays",
        },
        {
          id: "data",
          label: "Data & Charts",
          href: "/zoruui/data",
          icon: <ArrowUpRight />,
          active: pathname === "/zoruui/data",
        },
        {
          id: "marketing",
          label: "Marketing",
          href: "/zoruui/marketing",
          icon: <Monitor />,
          active: pathname === "/zoruui/marketing",
        },
        {
          id: "layout-elements",
          label: "Layout",
          href: "/zoruui/layout-elements",
          icon: <Layout />,
          active: pathname === "/zoruui/layout-elements",
        },
      ],
    },
  ];

  return (
    <ZoruShell
      sidebar={
        <ZoruAppSidebar
          heading="ZoruUI Gallery"
          caption="Components"
          groups={groups}
        />
      }
      contained
    >
      {children}
    </ZoruShell>
  );
}
