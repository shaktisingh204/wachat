/**
 * ZoruDock (shell scope) — re-export of the existing application dock.
 *
 * Per the zoruui plan, the dock is reused as-is (not rewritten).
 * Always import dock pieces from `@/components/zoruui/shell/zoru-dock`
 * or the top-level `@/components/zoruui` barrel inside the zoru shell.
 */
export {
  ZoruDock,
  ZoruDockIcon,
  type ZoruDockAccent,
} from "../dock";
