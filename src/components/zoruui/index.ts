/**
 * ZoruUI — public barrel.
 *
 * Step 1 (foundation): provider, cn, dock re-export.
 * Step 2 (atoms): button, input, textarea, label, checkbox, radio,
 *   switch, select, separator, skeleton, avatar, badge, kbd, progress,
 *   tooltip.
 *
 * Steps 3–6 add overlays, layout, data, and marketing primitives.
 */

// Foundation
export { ZoruProvider } from "./lib/zoru-provider";
export type { ZoruProviderProps } from "./lib/zoru-provider";
export { cn } from "./lib/cn";
export { ZoruDock, ZoruDockIcon, type ZoruDockAccent } from "./dock";

// Atoms — form & text primitives
export { ZoruButton, zoruButtonVariants, type ZoruButtonProps } from "./button";
export { ZoruInput, type ZoruInputProps } from "./input";
export { ZoruTextarea, type ZoruTextareaProps } from "./textarea";
export { ZoruLabel, type ZoruLabelProps } from "./label";
export { ZoruCheckbox } from "./checkbox";
export {
  ZoruRadioGroup,
  ZoruRadioGroupItem,
  ZoruRadioCard,
  type ZoruRadioCardProps,
} from "./radio-group";
export { ZoruSwitch, ZoruBouncyToggle, type ZoruBouncyToggleProps } from "./switch";
export {
  ZoruSelect,
  ZoruSelectGroup,
  ZoruSelectValue,
  ZoruSelectTrigger,
  ZoruSelectContent,
  ZoruSelectLabel,
  ZoruSelectItem,
  ZoruSelectSeparator,
} from "./select";
export { ZoruSeparator } from "./separator";
export { ZoruSkeleton, type ZoruSkeletonProps } from "./skeleton";
export { ZoruAvatar, ZoruAvatarImage, ZoruAvatarFallback } from "./avatar";
export { ZoruBadge, zoruBadgeVariants, type ZoruBadgeProps } from "./badge";
export { ZoruKbd, type ZoruKbdProps } from "./kbd";
export { ZoruProgress, type ZoruProgressProps } from "./progress";
export {
  ZoruTooltip,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  ZoruTooltipContent,
} from "./tooltip";
