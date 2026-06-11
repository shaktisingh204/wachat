/**
 * SabUI shell — composable chrome for the dashboard / admin / public
 * surfaces. Mount via `SabShell` and pass rail / sidebar / header /
 * dock slots. Step 8 wires the admin instance, step 9 wires the
 * dashboard instance.
 */
export { SabShell, type SabShellProps } from "./shell-root";
export {
  SabAppRail,
  type SabAppRailItem,
  type SabAppRailProps,
} from "./app-rail";
export {
  SabAppSidebar,
  type SabAppSidebarProps,
  type SabSidebarGroup,
  type SabSidebarLeaf,
} from "./app-sidebar";
export { SabHeader, type SabHeaderProps } from "./header";
export { SabDock, SabDockIcon, type SabDockAccent } from "./dock";
export { SabAppDock } from "./app-dock";
export { SabLaunchpad, type SabLaunchpadProps } from "./launchpad";
export {
  useDockApps,
  useDockAutoHide,
  type DockApps,
  type DockAutoHide,
} from "./use-dock-apps";
export { appAccent, appAccentGradient, type AppAccent } from "./app-colors";
export { SabAppLogo, hasAppGlyph, type SabAppLogoProps } from "./app-logos";
export {
  SabHomeShell,
  type SabHomeShellProps,
} from "./home-shell";
