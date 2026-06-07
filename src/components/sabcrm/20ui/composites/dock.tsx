/**
 * SabDock — re-export of the existing application dock.
 *
 * Per the plan, the dock is reused as-is (not rewritten or
 * restyled). The existing implementation already reads its colors from
 * shadcn CSS variables, which the `.zoruui` scope class remaps to the
 * zoru palette automatically — so no visual divergence and no duplicate
 * code.
 *
 * Always import dock pieces from `@/components/sabcrm/20ui/composites/dock` inside the
 * zoru shell so a future implementation swap stays a one-file change.
 */
export {
  Dock as SabDock,
  DockIcon as SabDockIcon,
  type DockAccent as SabDockAccent,
} from "@/components/ui/dock";
