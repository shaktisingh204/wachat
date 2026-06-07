/**
 * SabUI — public barrel.
 *
 * Step 1 (foundation): provider, cn, dock re-export.
 * Step 2 (atoms): button, input, textarea, label, checkbox, radio,
 *   switch, select, separator, skeleton, avatar, badge, kbd, progress,
 *   tooltip.
 *
 * Steps 3–6 add overlays, layout, data, and marketing primitives.
 */

// Foundation
export { SabProvider } from "./lib/provider";
export type { SabProviderProps } from "./lib/provider";
export { cn } from "./lib/cn";
export { SabDock, SabDockIcon, type SabDockAccent } from "./dock";

// Atoms — form & text primitives
export { Button, sabButtonVariants, type SabButtonProps } from "./button";
export { Input, type SabInputProps } from "./input";

export { Label, type SabLabelProps } from "./label";

export { Switch, SabBouncyToggle, type SabBouncyToggleProps } from "./switch";
export {
  TagPicker,
  SabTagPicker,
  type SabTagPickerProps,
  type SabTagPickerTag,
} from "./tag-picker";
// Tabs + Slider — Re-export from the legacy `@/components/ui` Radix wrappers
// while the SabUI-native primitives are still in design. Mid-migration
// callers (sabchat/*, etc.) import {Tabs, SabTabsList, SabTabsTrigger,
// SabTabsContent, Slider} from "@/components/sabcrm/20ui/composites" — wire those names
// here so nothing has to change at the call site.
export {
  Tabs,
  TabsList as SabTabsList,
  TabsTrigger as SabTabsTrigger,
  TabsContent as SabTabsContent,
} from "@/components/ui/tabs";
export { Slider } from "@/components/ui/slider";
// Form / Chart / Sidebar — re-exports from legacy `@/components/ui` while
// the SabUI-native primitives are still in design. Consumers should
// import from `@/components/sabcrm/20ui` so the migration path stays one-way.
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
  SabSelectGroup,
  SabSelectValue,
  SabSelectTrigger,
  SabSelectContent,
  SabSelectLabel,
  SabSelectItem,
  SabSelectSeparator,
} from "./select";

export { Avatar, SabAvatarImage, SabAvatarFallback, AvatarImage, AvatarFallback } from "./avatar";
export { Badge, sabBadgeVariants, type SabBadgeProps } from "./badge";
export { SabKbd, type SabKbdProps } from "./kbd";
export { Progress, type SabProgressProps } from "./progress";
export {
  Tooltip,
  SabTooltipProvider,
  SabTooltipTrigger,
  SabTooltipContent,
} from "./tooltip";

// Overlays, feedback & menus
export {
  Dialog,
  SabDialogTrigger,
  SabDialogClose,
  SabDialogPortal,
  SabDialogOverlay,
  SabDialogContent,
  SabDialogHeader,
  SabDialogFooter,
  SabDialogTitle,
  SabDialogDescription,
  type SabDialogContentProps,
} from "./dialog";
export {
  SabAlertDialog,
  SabAlertDialogTrigger,
  SabAlertDialogPortal,
  SabAlertDialogOverlay,
  SabAlertDialogContent,
  SabAlertDialogHeader,
  SabAlertDialogFooter,
  SabAlertDialogTitle,
  SabAlertDialogDescription,
  SabAlertDialogAction,
  SabAlertDialogCancel,
} from "./alert-dialog";

export {
  Popover,
  SabPopoverTrigger,
  SabPopoverAnchor,
  SabPopoverPortal,
  SabPopoverContent,
  PopoverTrigger,
  PopoverAnchor,
  PopoverPortal,
  PopoverContent,
} from "./popover";
export {
  DropdownMenu,
  SabDropdownMenuTrigger,
  SabDropdownMenuGroup,
  SabDropdownMenuPortal,
  SabDropdownMenuSub,
  SabDropdownMenuRadioGroup,
  SabDropdownMenuContent,
  SabDropdownMenuItem,
  SabDropdownMenuCheckboxItem,
  SabDropdownMenuRadioItem,
  SabDropdownMenuLabel,
  SabDropdownMenuSeparator,
  SabDropdownMenuShortcut,
  SabDropdownMenuSubTrigger,
  SabDropdownMenuSubContent,
} from "./dropdown-menu";

export {
  SabToast,
  SabToastProvider,
  SabToastViewport,
  SabToastTitle,
  SabToastDescription,
  SabToastAction,
  SabToastClose,
  type SabToastProps,
  type SabToastActionElement,
} from "./toast";
export {
  sabToast,
  useSabToast,
  type SabToastInput,
} from "./use-toast";

export {
  SabHeroPill,
  SabStarIcon,
  type SabHeroPillProps,
} from "./hero-pill";

// Layout & navigation

// Note: tab UI (`SabTabs` and friends) is intentionally NOT exported.
// Per the no-tab-ui directive, has no tab primitive — use
// segmented buttons, numbered steppers, or distinct routes instead.
export {
  Accordion,
  SabAccordionItem,
  SabAccordionTrigger,
  SabAccordionContent,
  SabAccordion03,
  SabAccordion03Item,
  SabAccordion03Trigger,
  SabAccordion03Content,
} from "./accordion";
export {
  SabCollapsible,
  SabCollapsibleTrigger,
  SabCollapsibleContent,
} from "./collapsible";
export { ScrollArea, SabScrollBar } from "./scroll-area";

export { EmptyState, type SabEmptyStateProps } from "./empty-state";

export {
  SabLimelightNav,
  type SabLimelightItem,
  type SabLimelightNavProps,
} from "./limelight-nav";

// Shell — composable dashboard chrome (no multi-tab strip)
export {
  SabShell,
  SabAppRail,
  SabAppSidebar,
  SabHeader,
  SabHomeShell,
  type SabShellProps,
  type SabAppRailItem,
  type SabAppRailProps,
  type SabAppSidebarProps,
  type SabSidebarGroup,
  type SabSidebarLeaf,
  type SabHeaderProps,
  type SabHomeShellProps,
} from "./shell";

// Data display & inputs

export {
  SabFullscreenCalendar,
  type SabFullscreenCalendarEvent,
  type SabFullscreenCalendarProps,
} from "./fullscreen-calendar";

export {
  SabChart,
  SabChartContainer,
  SabChartTooltip,
  SAB_CHART_PALETTE,
  type SabChartContainerProps,
  type SabChartTooltipProps,
} from "./chart";

export {
  SabStatisticsCard1,
  type SabStatisticsCard1Props,
  type SabStatisticsCard1Item,
} from "./statistics-card-1";

// Marketing & landing primitives

export {
  SabActionSearchBar,
  type SabActionSearchAction,
  type SabActionSearchBarProps,
} from "./action-search-bar";

export {
  SabUserDropdown,
  type SabUserDropdownProps,
  type SabUserDropdownItem,
} from "./user-dropdown";
export {
  SabNotificationPopover,
  type SabNotificationPopoverProps,
} from "./notification-popover";
export {
  SabDynamicSelector,
  type SabDynamicSelectorProps,
  type DynamicSelectorOption,
} from "./dynamic-selector";

// ── Transitional aliases ──────────────────────────────────────────────────
// Base component names are mid-migration from `Sab`-prefixed to bare
// (`SabButton` → `Button`, …). These aliases keep not-yet-migrated call
// sites compiling during the rename. Remove this block once every consumer
// has been moved to the bare names.
export { Button as SabButton } from "./button";
export { Input as SabInput } from "./input";

export { Label as SabLabel } from "./label";

export { Switch as SabSwitch } from "./switch";
export { Select as SabSelect } from "./select";

export { Avatar as SabAvatar } from "./avatar";
export { Badge as SabBadge } from "./badge";
export { Progress as SabProgress } from "./progress";
export { Tooltip as SabTooltip } from "./tooltip";
export { Dialog as SabDialog } from "./dialog";

export { Popover as SabPopover } from "./popover";
export { DropdownMenu as SabDropdownMenu } from "./dropdown-menu";

export { Accordion as SabAccordion } from "./accordion";
export { ScrollArea as SabScrollArea } from "./scroll-area";
export { EmptyState as SabEmptyState } from "./empty-state";

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
  SabAccordionItem as AccordionItem,
  SabAccordionTrigger as AccordionTrigger,
  SabAccordionContent as AccordionContent,
} from "./accordion";

