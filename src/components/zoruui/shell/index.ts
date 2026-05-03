/**
 * ZoruUI shell — composable chrome for the dashboard / admin / public
 * surfaces. Mount via `ZoruShell` and pass rail / sidebar / header /
 * dock slots. Step 8 wires the admin instance, step 9 wires the
 * dashboard instance.
 */
export { ZoruShell, type ZoruShellProps } from "./zoru-shell";
export {
  ZoruAppRail,
  type ZoruAppRailItem,
  type ZoruAppRailProps,
} from "./zoru-app-rail";
export {
  ZoruAppSidebar,
  type ZoruAppSidebarProps,
  type ZoruSidebarGroup,
  type ZoruSidebarLeaf,
} from "./zoru-app-sidebar";
export { ZoruHeader, type ZoruHeaderProps } from "./zoru-header";
export { ZoruDock, ZoruDockIcon, type ZoruDockAccent } from "./zoru-dock";
