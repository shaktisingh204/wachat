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
export { Button, zoruButtonVariants, type ZoruButtonProps } from "./button";
export { Input, type ZoruInputProps } from "./input";

export { Label, type ZoruLabelProps } from "./label";

export { Switch, ZoruBouncyToggle, type ZoruBouncyToggleProps } from "./switch";
export {
  TagPicker,
  ZoruTagPicker,
  type ZoruTagPickerProps,
  type ZoruTagPickerTag,
} from "./tag-picker";
// Tabs + Slider — Re-export from the legacy `@/components/ui` Radix wrappers
// while the ZoruUI-native primitives are still in design. Mid-migration
// callers (sabchat/*, etc.) import {Tabs, ZoruTabsList, ZoruTabsTrigger,
// ZoruTabsContent, Slider} from "@/components/sabcrm/20ui/composites" — wire those names
// here so nothing has to change at the call site.
export {
  Tabs,
  TabsList as ZoruTabsList,
  TabsTrigger as ZoruTabsTrigger,
  TabsContent as ZoruTabsContent,
} from "@/components/ui/tabs";
export { Slider } from "@/components/ui/slider";
// Form / Chart / Sidebar — re-exports from legacy `@/components/ui` while
// the ZoruUI-native primitives are still in design. Consumers should
// import from `@/components/zoruui` so the migration path stays one-way.
export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
} from "@/components/ui/form";
export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  type ChartConfig,
} from "@/components/ui/chart";
export {
  useSidebar,
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
} from "@/components/ui/sidebar";
export { SabNodeSidebar } from "@/components/ui/sidebar-component";
// SabNodeWaterLoader: real export is `SabNodeWaterLoader` (capital N).
// Alias `SabnodeWaterLoader` for the one consumer that imports the
// lowercase-n typo, so we don't have to edit that file in this pass.
export {
  SabNodeWaterLoader,
  SabNodeWaterLoader as SabnodeWaterLoader,
  SabNodeWaterLoaderScreen,
} from "@/components/ui/sabnode-water-loader";
// Bare-name Tabs aliases — consumers in sabsms/* import the unprefixed
// `TabsList` / `TabsTrigger` / `TabsContent` from this barrel.
export {
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
export {
  Select,
  ZoruSelectGroup,
  ZoruSelectValue,
  ZoruSelectTrigger,
  ZoruSelectContent,
  ZoruSelectLabel,
  ZoruSelectItem,
  ZoruSelectSeparator,
} from "./select";

export { Avatar, ZoruAvatarImage, ZoruAvatarFallback, AvatarImage, AvatarFallback } from "./avatar";
export { Badge, zoruBadgeVariants, type ZoruBadgeProps } from "./badge";
export { ZoruKbd, type ZoruKbdProps } from "./kbd";
export { Progress, type ZoruProgressProps } from "./progress";
export {
  Tooltip,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  ZoruTooltipContent,
} from "./tooltip";

// Overlays, feedback & menus
export {
  Dialog,
  ZoruDialogTrigger,
  ZoruDialogClose,
  ZoruDialogPortal,
  ZoruDialogOverlay,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogFooter,
  ZoruDialogTitle,
  ZoruDialogDescription,
  type ZoruDialogContentProps,
} from "./dialog";
export {
  ZoruAlertDialog,
  ZoruAlertDialogTrigger,
  ZoruAlertDialogPortal,
  ZoruAlertDialogOverlay,
  ZoruAlertDialogContent,
  ZoruAlertDialogHeader,
  ZoruAlertDialogFooter,
  ZoruAlertDialogTitle,
  ZoruAlertDialogDescription,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
} from "./alert-dialog";

export {
  Popover,
  ZoruPopoverTrigger,
  ZoruPopoverAnchor,
  ZoruPopoverPortal,
  ZoruPopoverContent,
  PopoverTrigger,
  PopoverAnchor,
  PopoverPortal,
  PopoverContent,
} from "./popover";
export {
  DropdownMenu,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuGroup,
  ZoruDropdownMenuPortal,
  ZoruDropdownMenuSub,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuCheckboxItem,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuShortcut,
  ZoruDropdownMenuSubTrigger,
  ZoruDropdownMenuSubContent,
} from "./dropdown-menu";

export {
  ZoruToast,
  ZoruToastProvider,
  ZoruToastViewport,
  ZoruToastTitle,
  ZoruToastDescription,
  ZoruToastAction,
  ZoruToastClose,
  type ZoruToastProps,
  type ZoruToastActionElement,
} from "./toast";
export {
  zoruToast,
  useZoruToast,
  type ZoruToastInput,
} from "./use-zoru-toast";

export {
  ZoruHeroPill,
  ZoruStarIcon,
  type ZoruHeroPillProps,
} from "./hero-pill";

// Layout & navigation

// Note: tab UI (`ZoruTabs` and friends) is intentionally NOT exported.
// Per the no-tab-ui directive, has no tab primitive — use
// segmented buttons, numbered steppers, or distinct routes instead.
export {
  Accordion,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  ZoruAccordionContent,
  ZoruAccordion03,
  ZoruAccordion03Item,
  ZoruAccordion03Trigger,
  ZoruAccordion03Content,
} from "./accordion";
export {
  ZoruCollapsible,
  ZoruCollapsibleTrigger,
  ZoruCollapsibleContent,
} from "./collapsible";
export { ScrollArea, ZoruScrollBar } from "./scroll-area";

export { EmptyState, type ZoruEmptyStateProps } from "./empty-state";

export {
  ZoruLimelightNav,
  type ZoruLimelightItem,
  type ZoruLimelightNavProps,
} from "./limelight-nav";

// Shell — composable dashboard chrome (no multi-tab strip)
export {
  ZoruShell,
  ZoruAppRail,
  ZoruAppSidebar,
  ZoruHeader,
  ZoruHomeShell,
  type ZoruShellProps,
  type ZoruAppRailItem,
  type ZoruAppRailProps,
  type ZoruAppSidebarProps,
  type ZoruSidebarGroup,
  type ZoruSidebarLeaf,
  type ZoruHeaderProps,
  type ZoruHomeShellProps,
} from "./shell";

// Data display & inputs

export {
  ZoruFullscreenCalendar,
  type ZoruFullscreenCalendarEvent,
  type ZoruFullscreenCalendarProps,
} from "./fullscreen-calendar";

export {
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZORU_CHART_PALETTE,
  type ZoruChartContainerProps,
  type ZoruChartTooltipProps,
} from "./chart";

export {
  ZoruStatisticsCard1,
  type ZoruStatisticsCard1Props,
  type ZoruStatisticsCard1Item,
} from "./statistics-card-1";

// Marketing & landing primitives

export {
  ZoruActionSearchBar,
  type ZoruActionSearchAction,
  type ZoruActionSearchBarProps,
} from "./action-search-bar";

export {
  ZoruUserDropdown,
  type ZoruUserDropdownProps,
  type ZoruUserDropdownItem,
} from "./user-dropdown";
export {
  ZoruNotificationPopover,
  type ZoruNotificationPopoverProps,
} from "./notification-popover";
export {
  ZoruDynamicSelector,
  type ZoruDynamicSelectorProps,
  type DynamicSelectorOption,
} from "./dynamic-selector";

// ── Transitional aliases ──────────────────────────────────────────────────
// Base component names are mid-migration from `Zoru`-prefixed to bare
// (`ZoruButton` → `Button`, …). These aliases keep not-yet-migrated call
// sites compiling during the rename. Remove this block once every consumer
// has been moved to the bare names.
export { Button as ZoruButton } from "./button";
export { Input as ZoruInput } from "./input";

export { Label as ZoruLabel } from "./label";

export { Switch as ZoruSwitch } from "./switch";
export { Select as ZoruSelect } from "./select";

export { Avatar as ZoruAvatar } from "./avatar";
export { Badge as ZoruBadge } from "./badge";
export { Progress as ZoruProgress } from "./progress";
export { Tooltip as ZoruTooltip } from "./tooltip";
export { Dialog as ZoruDialog } from "./dialog";

export { Popover as ZoruPopover } from "./popover";
export { DropdownMenu as ZoruDropdownMenu } from "./dropdown-menu";

export { Accordion as ZoruAccordion } from "./accordion";
export { ScrollArea as ZoruScrollArea } from "./scroll-area";
export { EmptyState as ZoruEmptyState } from "./empty-state";

// Transitional bare-name subcomponent aliases
export {
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./dialog";

export {
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuRadioGroup,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "./dropdown-menu";

export {
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from "./select";

export {
  ZoruAccordionItem as AccordionItem,
  ZoruAccordionTrigger as AccordionTrigger,
  ZoruAccordionContent as AccordionContent,
} from "./accordion";

