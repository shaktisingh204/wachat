"use client";

/**
 * SabcrmShell — module chrome for the native SabCRM surface.
 *
 * A thin client wrapper over the shared
 * `SabHomeShell` (app rail + sidebar + header + main). It owns nothing
 * bespoke — it only builds the SabCRM-specific grouped sidebar so every
 * `/dashboard/sabcrm/*` page renders inside the SAME chrome as the rest
 * of the dashboard.
 *
 * The sidebar lists the metadata-driven CRM objects (Companies, People,
 * Opportunities, …) fetched via {@link listObjectsAction}. Each object's
 * `icon` string (a lucide name) is resolved to a real icon node. The
 * server action already enforces session → project → RBAC → plan, so a
 * caller without access simply gets an empty object list (and the page
 * body renders its own permission state).
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { icons as lucideIcons, Database, Plus } from "lucide-react";

import { SabHomeShell } from '@/components/sabcrm/20ui';
import type { SidebarGroup, SidebarLeaf } from '@/components/sabcrm/20ui';
import { listObjectsAction } from "@/app/actions/sabcrm.actions";
import type { ObjectMetadata } from "@/lib/sabcrm/types";
import { SabcrmCommand } from "./sabcrm-command";

/** Base route every SabCRM page lives under. */
const CRM_BASE_PATH = "/dashboard/sabcrm";

export interface SabcrmShellProps {
  user?: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
    role?: string | null;
  };
  plan?: {
    name?: string | null;
    credits?: number;
  };
  /**
   * Optional pre-fetched objects. When the hosting layout (a server
   * component) has already resolved the object list it can pass it in to
   * avoid a client round-trip; otherwise the shell fetches them itself.
   */
  initialObjects?: ObjectMetadata[];
  children: React.ReactNode;
}

/**
 * Resolves a lucide icon name (as stored on {@link ObjectMetadata.icon})
 * to a React node, falling back to a neutral Database glyph. `lucide-react`
 * exposes every icon on its `icons` map keyed by PascalCase name.
 */
function resolveObjectIcon(name: string | undefined): React.ReactNode {
  if (name && name in lucideIcons) {
    const Icon = lucideIcons[name as keyof typeof lucideIcons];
    return <Icon />;
  }
  return <Database />;
}

/**
 * Builds the SabCRM grouped sidebar from the object metadata list. One
 * "Records" group lists every object; a static "Workspace" group holds the
 * module overview + data-model settings entry points.
 */
function buildSabcrmSidebarGroups(
  objects: ObjectMetadata[],
  pathname: string | null,
): SidebarGroup[] {
  const path = pathname ?? "";

  const objectLeaves: SidebarLeaf[] = objects.map((obj) => {
    const href = `${CRM_BASE_PATH}/${obj.slug}`;
    return {
      id: `object-${obj.slug}`,
      label: obj.labelPlural,
      icon: resolveObjectIcon(obj.icon),
      href,
      active: path === href || path.startsWith(`${href}/`),
    };
  });

  const groups: SidebarGroup[] = [
    {
      id: "workspace",
      label: "Workspace",
      items: [
        {
          id: "overview",
          label: "Overview",
          icon: <Database />,
          href: CRM_BASE_PATH,
          active: path === CRM_BASE_PATH,
        },
      ],
    },
  ];

  groups.push({
    id: "records",
    label: "Records",
    items:
      objectLeaves.length > 0
        ? objectLeaves
        : [
            {
              id: "no-objects",
              label: "No objects yet",
              icon: <Plus />,
              href: CRM_BASE_PATH,
            },
          ],
  });

  return groups;
}

/**
 * SabcrmShell — wraps `SabHomeShell` with the SabCRM object sidebar.
 */
export function SabcrmShell({
  user,
  plan,
  initialObjects,
  children,
}: SabcrmShellProps) {
  const pathname = usePathname();
  const [objects, setObjects] = React.useState<ObjectMetadata[]>(
    initialObjects ?? [],
  );
  const [commandOpen, setCommandOpen] = React.useState(false);

  // Global ⌘K / Ctrl+K toggles the command palette anywhere in the SabCRM shell.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fetch the object list client-side when not supplied by the layout.
  // `listObjectsAction` is fully gated server-side, so an unauthorised or
  // off-plan caller simply receives an error → empty sidebar.
  React.useEffect(() => {
    if (initialObjects && initialObjects.length > 0) return;
    let cancelled = false;
    void (async () => {
      const result = await listObjectsAction();
      if (cancelled) return;
      if (result.ok) setObjects(result.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialObjects]);

  const groups = React.useMemo(
    () => buildSabcrmSidebarGroups(objects, pathname),
    [objects, pathname],
  );

  return (
    <SabHomeShell
      user={user}
      plan={plan}
      sidebarHeading="SabCRM"
      sidebarCaption="Customer records"
      sidebarGroups={groups}
    >
      {children}
      <SabcrmCommand
        objects={objects}
        open={commandOpen}
        onOpenChange={setCommandOpen}
      />
    </SabHomeShell>
  );
}
