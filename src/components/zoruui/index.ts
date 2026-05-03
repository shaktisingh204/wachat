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

// Overlays, feedback & menus
export {
  ZoruDialog,
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
  ZoruSheet,
  ZoruSheetTrigger,
  ZoruSheetClose,
  ZoruSheetPortal,
  ZoruSheetContent,
  ZoruSheetHeader,
  ZoruSheetFooter,
  ZoruSheetTitle,
  ZoruSheetDescription,
  type ZoruSheetContentProps,
} from "./sheet";
export {
  ZoruDrawer,
  ZoruDrawerTrigger,
  ZoruDrawerPortal,
  ZoruDrawerClose,
  ZoruDrawerOverlay,
  ZoruDrawerContent,
  ZoruDrawerHeader,
  ZoruDrawerFooter,
  ZoruDrawerTitle,
  ZoruDrawerDescription,
} from "./drawer";
export {
  ZoruPopover,
  ZoruPopoverTrigger,
  ZoruPopoverAnchor,
  ZoruPopoverPortal,
  ZoruPopoverContent,
} from "./popover";
export {
  ZoruDropdownMenu,
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
  ZoruMenubar,
  ZoruMenubarMenu,
  ZoruMenubarGroup,
  ZoruMenubarPortal,
  ZoruMenubarSub,
  ZoruMenubarRadioGroup,
  ZoruMenubarTrigger,
  ZoruMenubarSubTrigger,
  ZoruMenubarSubContent,
  ZoruMenubarContent,
  ZoruMenubarItem,
  ZoruMenubarCheckboxItem,
  ZoruMenubarRadioItem,
  ZoruMenubarLabel,
  ZoruMenubarSeparator,
  ZoruMenubarShortcut,
} from "./menubar";
export {
  ZoruCommand,
  ZoruCommandDialog,
  ZoruCommandInput,
  ZoruCommandList,
  ZoruCommandEmpty,
  ZoruCommandGroup,
  ZoruCommandSeparator,
  ZoruCommandItem,
  ZoruCommandShortcut,
  type ZoruCommandDialogProps,
} from "./command";
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
export { ZoruToaster } from "./toaster";
export { ZoruSonner, zoruSonnerToast } from "./sonner";
export {
  ZoruAlert,
  ZoruAlertTitle,
  ZoruAlertDescription,
  type ZoruAlertProps,
} from "./alert";
export {
  ZoruHeroPill,
  ZoruStarIcon,
  type ZoruHeroPillProps,
} from "./hero-pill";

// Layout & navigation
export {
  ZoruCard,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruCardDescription,
  ZoruCardContent,
  ZoruCardFooter,
  zoruCardVariants,
  type ZoruCardProps,
} from "./card";
export {
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageEyebrow,
  ZoruPageTitle,
  ZoruPageDescription,
  ZoruPageActions,
  type ZoruPageHeaderProps,
} from "./page-header";
export {
  ZoruBreadcrumb,
  ZoruBreadcrumbList,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruBreadcrumbEllipsis,
} from "./breadcrumb";
export {
  ZoruTabs,
  ZoruTabsList,
  ZoruTabsTrigger,
  ZoruTabsContent,
  ZoruTabsListUnderline,
  ZoruTabsTriggerUnderline,
} from "./tabs";
export {
  ZoruAccordion,
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
export { ZoruScrollArea, ZoruScrollBar } from "./scroll-area";
export {
  ZoruResizablePanelGroup,
  ZoruResizablePanel,
  ZoruResizableHandle,
} from "./resizable";
export { ZoruEmptyState, type ZoruEmptyStateProps } from "./empty-state";
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
  ZoruTable,
  ZoruTableHeader,
  ZoruTableBody,
  ZoruTableFooter,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableCell,
  ZoruTableCaption,
} from "./table";
export {
  ZoruDataTable,
  type ZoruDataTableProps,
} from "./data-table";
export {
  ZoruTableWithDialog,
  type ZoruTableWithDialogProps,
  type ZoruTableColumn,
} from "./table-with-dialog";
export { ZoruCalendar, type ZoruCalendarProps } from "./calendar";
export {
  ZoruCalendarLume,
  type ZoruCalendarLumeProps,
} from "./calendar-lume";
export {
  ZoruFullscreenCalendar,
  type ZoruFullscreenCalendarEvent,
  type ZoruFullscreenCalendarProps,
} from "./fullscreen-calendar";
export {
  ZoruDatePicker,
  ZoruDateRangePicker,
  type ZoruDatePickerProps,
  type ZoruDateRangePickerProps,
} from "./date-picker";
export {
  ZoruFileUploadCard,
  type ZoruFileUploadCardProps,
  type ZoruFileUploadItem,
} from "./file-upload-card";
export {
  ZoruFileCardCollections,
  type ZoruFileCardCollectionsProps,
  type ZoruFileCardItem,
} from "./file-card-collections";
export {
  ZoruFilesPage,
  ZoruFileToolbar,
  ZoruFileGrid,
  ZoruFileList,
  ZoruFilePreviewDialog,
  ZoruFileRenameDialog,
  ZoruFileDeleteDialog,
  ZoruFileShareDialog,
  ZoruFileUploadDialog,
  type ZoruFilesPageProps,
  type ZoruFileToolbarProps,
  type ZoruFileGridProps,
  type ZoruFileListProps,
  type ZoruFilePreviewDialogProps,
  type ZoruFileRenameDialogProps,
  type ZoruFileDeleteDialogProps,
  type ZoruFileShareDialogProps,
  type ZoruFileShareAccess,
  type ZoruFileUploadDialogProps,
  type ZoruFileEntity,
  type ZoruFileView,
} from "./files-module";
export {
  ZoruChart,
  ZoruChartContainer,
  ZoruChartTooltip,
  ZORU_CHART_PALETTE,
  type ZoruChartContainerProps,
  type ZoruChartTooltipProps,
} from "./chart";
export { ZoruStatCard, type ZoruStatCardProps } from "./stat-card";
export {
  ZoruStatisticsCard1,
  type ZoruStatisticsCard1Props,
  type ZoruStatisticsCard1Item,
} from "./statistics-card-1";
export {
  ZoruCarousel,
  ZoruCarouselItem,
  type ZoruCarouselProps,
} from "./carousel";
export {
  ZoruColorPicker,
  type ZoruColorPickerProps,
} from "./color-picker";

// Marketing & landing primitives
export {
  ZoruCallToAction,
  type ZoruCallToActionProps,
} from "./call-to-action";
export {
  ZoruTestimonialsColumns,
  ZoruTestimonialsColumn,
  ZoruTestimonialCard,
  type ZoruTestimonial,
  type ZoruTestimonialsColumnProps,
  type ZoruTestimonialsColumnsProps,
} from "./testimonials-columns";
export {
  ZoruLogos3,
  type ZoruLogo,
  type ZoruLogos3Props,
} from "./logos3";
export {
  ZoruActionSearchBar,
  type ZoruActionSearchAction,
  type ZoruActionSearchBarProps,
} from "./action-search-bar";
export {
  ZoruJobListing,
  type ZoruJob,
  type ZoruJobListingProps,
} from "./joblisting";
export {
  ZoruPricingCard,
  ZoruPricingTier,
  type ZoruPricingCardProps,
  type ZoruPricingTierProps,
  type ZoruPricingFeature,
} from "./pricing-card";
export {
  ZoruFeatureCard,
  ZoruFeatureGrid,
  type ZoruFeatureCardProps,
  type ZoruFeatureGridProps,
} from "./feature-grid";
export {
  ZoruWaterLoader,
  type ZoruWaterLoaderProps,
} from "./water-loader";
export {
  ZoruUserDropdown,
  type ZoruUserDropdownProps,
  type ZoruUserDropdownItem,
} from "./user-dropdown";
