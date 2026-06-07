/**
 * SabDock (shell scope) — re-export of the existing application dock.
 *
 * Per the plan, the dock is reused as-is (not rewritten).
 * Always import dock pieces from `@/components/sabcrm/20ui/composites/shell/dock`
 * or the top-level `@/components/zoruui` barrel inside the zoru shell.
 */
export {
  SabDock,
  SabDockIcon,
  type SabDockAccent,
} from "../dock";
