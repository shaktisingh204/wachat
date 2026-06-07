/**
 * SabUI shell — composable chrome for the dashboard / admin / public
 * surfaces. Mount via `SabShell` and pass rail / sidebar / header /
 * dock slots. Step 8 wires the admin instance, step 9 wires the
 * dashboard instance.
 */
export { SabShell, type SabShellProps } from "./zoru-shell";
export {
  SabAppRail,
  type SabAppRailItem,
  type SabAppRailProps,
} from "./zoru-app-rail";
export {
  SabAppSidebar,
  type SabAppSidebarProps,
  type SabSidebarGroup,
  type SabSidebarLeaf,
} from "./zoru-app-sidebar";
export { SabHeader, type SabHeaderProps } from "./zoru-header";
export { SabDock, SabDockIcon, type SabDockAccent } from "./zoru-dock";
export {
  SabHomeShell,
  type SabHomeShellProps,
} from "./zoru-home-shell";
