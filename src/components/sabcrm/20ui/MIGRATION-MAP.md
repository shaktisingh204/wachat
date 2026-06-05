# 20ui Migration Map — Phase D

**Authoritative reference for agents converting ZoruUI (`@/components/zoruui`) and
shadcn (`@/components/ui`) usage to `@/components/sabcrm/20ui`.**

---

## 1. Swap type legend

| Swap type | Meaning |
|---|---|
| `pure-import-swap` | Identical name and API — change only the import path. |
| `rename` | Name changes; API is otherwise identical or trivially compatible. |
| `restructure` | Both name and API change — read the "Notes" column before acting. |
| `already-20ui` | Symbol already lives in 20ui; no source import required. |

---

## 2. Component mapping table

### Select family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Select` (props-based, ZoruUI `./select`) | `SelectField` | `rename` | ZoruUI's `Select` takes `options[]` + `value/onChange`. The 20ui props-based equivalent is `SelectField` (same API, renamed to free up the `Select` name for the compound root). |
| `ZoruSelect` (alias) | `SelectField` | `rename` | Same as above — was a transitional alias. |
| `Select` (compound root — shadcn / `@/components/ui/select`) | `Select` (from `select-radix.tsx`) | `pure-import-swap` | Compound root: `import { Select } from '@/components/sabcrm/20ui'`. The Radix API is identical. |
| `SelectTrigger` | `SelectTrigger` | `pure-import-swap` | |
| `SelectValue` | `SelectValue` | `pure-import-swap` | |
| `SelectContent` | `SelectContent` | `pure-import-swap` | |
| `SelectItem` | `SelectItem` | `pure-import-swap` | |
| `SelectGroup` | `SelectGroup` | `pure-import-swap` | |
| `SelectLabel` | `SelectLabel` | `pure-import-swap` | |
| `SelectSeparator` | `SelectSeparator` | `pure-import-swap` | |
| `SelectScrollUpButton` | `SelectScrollUpButton` | `pure-import-swap` | |
| `SelectScrollDownButton` | `SelectScrollDownButton` | `pure-import-swap` | |
| `ZoruSelectGroup` / `ZoruSelectValue` / `ZoruSelectTrigger` / `ZoruSelectContent` / `ZoruSelectLabel` / `ZoruSelectItem` / `ZoruSelectSeparator` | Drop the `Zoru` prefix → same names above | `rename` | All map to the bare compound sub-components. |
| `MultiSelect` (ZoruUI) | `MultiSelect` | `pure-import-swap` | Props-based multi-select; same `options[]` API. |

### Table family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Table` / `ZoruTable` | `Table` | `pure-import-swap` | |
| `ZoruTableHeader` / `TableHeader` | `THead` | `rename` | 20ui uses HTML-semantic names: `THead`, `TBody`, `TFoot`. |
| `ZoruTableBody` / `TableBody` | `TBody` | `rename` | |
| `ZoruTableFooter` / `TableFooter` | `TFoot` | `rename` | |
| `ZoruTableRow` / `TableRow` | `Tr` | `rename` | |
| `ZoruTableHead` / `TableHead` | `Th` | `rename` | `Th` gains an optional `sortable`/`sortDir` prop; remove any bespoke sort chevron markup. |
| `ZoruTableCell` / `TableCell` | `Td` | `rename` | |
| `ZoruTableCaption` / `TableCaption` | `TCaption` | `rename` | |
| `DataTable` / `ZoruDataTable` | `DataTable` | `pure-import-swap` | Column type: `DataTableColumn<T>` (was `ZoruDataTableProps`). |
| `ZoruTableWithDialog` | `TableWithDialog` | `rename` | Same compound but exported without the `Zoru` prefix from `tablewithdialog.tsx`. |

### Card family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Card` / `ZoruCard` | `Card` | `pure-import-swap` | Variant prop changes: ZoruUI `zoruCardVariants` → 20ui `variant: 'elevated' \| 'outlined' \| 'ghost' \| 'interactive'`. |
| `ZoruCardHeader` / `CardHeader` | `CardHeader` | `pure-import-swap` | |
| `ZoruCardTitle` / `CardTitle` | `CardTitle` | `pure-import-swap` | |
| `ZoruCardDescription` / `CardDescription` | `CardDescription` | `pure-import-swap` | |
| `ZoruCardContent` / `CardContent` | `CardBody` | `rename` | ZoruUI exported `CardContent`; 20ui uses `CardBody`. |
| `ZoruCardFooter` / `CardFooter` | `CardFooter` | `pure-import-swap` | |
| `StatCard` / `ZoruStatCard` | `StatCard` | `pure-import-swap` | |
| `zoruCardVariants` | Remove | `restructure` | Replace cva class composition with the `variant` prop on `Card`. |

### Dialog family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Dialog` / `ZoruDialog` | `Dialog` | `pure-import-swap` | 20ui Dialog is the full compound (Radix-backed), same root API. |
| `ZoruDialogTrigger` / `DialogTrigger` | `DialogTrigger` | `pure-import-swap` | |
| `ZoruDialogClose` / `DialogClose` | `DialogClose` | `pure-import-swap` | |
| `ZoruDialogPortal` / `DialogPortal` | `DialogPortal` | `pure-import-swap` | |
| `ZoruDialogOverlay` / `DialogOverlay` | `DialogOverlay` | `pure-import-swap` | |
| `ZoruDialogContent` / `DialogContent` | `DialogContent` | `pure-import-swap` | |
| `ZoruDialogHeader` / `DialogHeader` | `DialogHeader` | `pure-import-swap` | |
| `ZoruDialogFooter` / `DialogFooter` | `DialogFooter` | `pure-import-swap` | |
| `ZoruDialogTitle` / `DialogTitle` | `DialogTitle` | `pure-import-swap` | |
| `ZoruDialogDescription` / `DialogDescription` | `DialogDescription` | `pure-import-swap` | |
| `Modal` (ZoruUI or shadcn standalone) | `Modal` | `pure-import-swap` | 20ui `Modal` is the single-component props API (`open`, `onClose`, `title`, `size`). Use this when no compound slots are needed; use `Dialog` compound otherwise. |
| `ZoruAlertDialog` | `AlertDialog` | `rename` | |
| `ZoruAlertDialogTrigger/Content/Header/Footer/Title/Description/Action/Cancel` | Drop `Zoru` prefix | `rename` | All map to bare `AlertDialog*` names in `alertdialog.tsx`. |

### DropdownMenu family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `DropdownMenu` / `ZoruDropdownMenu` | `DropdownMenu` | `pure-import-swap` | |
| `DropdownMenuTrigger` / `ZoruDropdownMenuTrigger` | `DropdownMenuTrigger` | `pure-import-swap` | |
| `DropdownMenuContent` / `ZoruDropdownMenuContent` | `DropdownMenuContent` | `pure-import-swap` | |
| `DropdownMenuItem` / `ZoruDropdownMenuItem` | `DropdownMenuItem` | `pure-import-swap` | |
| `DropdownMenuCheckboxItem` / `ZoruDropdownMenuCheckboxItem` | `DropdownMenuCheckboxItem` | `pure-import-swap` | |
| `DropdownMenuRadioItem` / `ZoruDropdownMenuRadioItem` | `DropdownMenuRadioItem` | `pure-import-swap` | |
| `DropdownMenuLabel` / `ZoruDropdownMenuLabel` | `DropdownMenuLabel` | `pure-import-swap` | |
| `DropdownMenuSeparator` / `ZoruDropdownMenuSeparator` | `DropdownMenuSeparator` | `pure-import-swap` | |
| `DropdownMenuShortcut` / `ZoruDropdownMenuShortcut` | `DropdownMenuShortcut` | `pure-import-swap` | |
| `DropdownMenuGroup` / `ZoruDropdownMenuGroup` | `DropdownMenuGroup` | `pure-import-swap` | |
| `DropdownMenuPortal` / `ZoruDropdownMenuPortal` | `DropdownMenuPortal` | `pure-import-swap` | |
| `DropdownMenuSub` / `ZoruDropdownMenuSub` | `DropdownMenuSub` | `pure-import-swap` | |
| `DropdownMenuSubTrigger` / `ZoruDropdownMenuSubTrigger` | `DropdownMenuSubTrigger` | `pure-import-swap` | |
| `DropdownMenuSubContent` / `ZoruDropdownMenuSubContent` | `DropdownMenuSubContent` | `pure-import-swap` | |
| `DropdownMenuRadioGroup` / `ZoruDropdownMenuRadioGroup` | `DropdownMenuRadioGroup` | `pure-import-swap` | |

### Breadcrumb family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Breadcrumb` / `ZoruBreadcrumb` | `Breadcrumb` (from `breadcrumb.tsx`) | `pure-import-swap` | The full compound lives in `breadcrumb.tsx`. Note: `misc.tsx` also exports a props-based `Breadcrumb({ items[] })`; that is the `BreadcrumbBar` alias pattern — prefer the compound form going forward. |
| `ZoruBreadcrumbList` | `BreadcrumbList` | `rename` | |
| `ZoruBreadcrumbItem` | `BreadcrumbItem` | `rename` | |
| `ZoruBreadcrumbLink` | `BreadcrumbLink` | `rename` | |
| `ZoruBreadcrumbPage` | `BreadcrumbPage` | `rename` | |
| `ZoruBreadcrumbSeparator` | `BreadcrumbSeparator` | `rename` | |
| `ZoruBreadcrumbEllipsis` | `BreadcrumbEllipsis` | `rename` | |

### Tabs family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Tabs` (props-based — ZoruUI `items[]` array) | `TabsBar` | `rename` | The old data-driven single-component Tabs is now `TabsBar`. |
| `Tabs` (compound Radix root — from `@/components/ui/tabs`) | `Tabs` (from `tabs-radix.tsx`) | `pure-import-swap` | The compound Radix root keeps the name `Tabs`. Import it from `@/components/sabcrm/20ui`. |
| `TabsList` / `ZoruTabsList` | `TabsList` | `pure-import-swap` | |
| `TabsTrigger` / `ZoruTabsTrigger` | `TabsTrigger` | `pure-import-swap` | |
| `TabsContent` / `ZoruTabsContent` | `TabsContent` | `pure-import-swap` | |
| `TabPanel` | `TabPanel` (from `tabs.tsx`) | `pure-import-swap` | Content panel for the props-based `TabsBar`. |

### Tooltip family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Tooltip` (props-based — ZoruUI single-child `content` prop) | `SimpleTooltip` | `rename` | The old props-based single-trigger Tooltip is now `SimpleTooltip` in `tooltip.tsx`. |
| `ZoruTooltip` (alias) | `SimpleTooltip` | `rename` | Same. |
| `Tooltip` (compound Radix root — shadcn pattern) | `Tooltip` (from `tooltip-radix.tsx`) | `pure-import-swap` | Compound root keeps the name. |
| `TooltipProvider` / `ZoruTooltipProvider` | `TooltipProvider` | `pure-import-swap` | |
| `TooltipTrigger` / `ZoruTooltipTrigger` | `TooltipTrigger` | `pure-import-swap` | |
| `TooltipContent` / `ZoruTooltipContent` | `TooltipContent` | `pure-import-swap` | |

### Popover family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Popover` / `ZoruPopover` | `Popover` | `pure-import-swap` | |
| `PopoverTrigger` / `ZoruPopoverTrigger` | `PopoverTrigger` | `pure-import-swap` | |
| `PopoverAnchor` / `ZoruPopoverAnchor` | `PopoverAnchor` | `pure-import-swap` | |
| `PopoverContent` / `ZoruPopoverContent` | `PopoverContent` | `pure-import-swap` | |
| `PopoverClose` | `PopoverClose` | `pure-import-swap` | |
| `PopoverPortal` / `ZoruPopoverPortal` | Remove or use `PopoverContent` directly | `restructure` | 20ui Popover portals via its own `PopoverContent`; a bare `PopoverPortal` export is not exposed. Remove wrapper if it was used only to portal content. |

### Sheet family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Sheet` / `ZoruSheet` | `Sheet` | `pure-import-swap` | |
| `SheetTrigger` / `ZoruSheetTrigger` | `SheetTrigger` | `pure-import-swap` | |
| `SheetClose` / `ZoruSheetClose` | `SheetClose` | `pure-import-swap` | |
| `SheetPortal` / `ZoruSheetPortal` | `SheetPortal` | `pure-import-swap` | |
| `SheetContent` / `ZoruSheetContent` | `SheetContent` | `pure-import-swap` | `side` prop values unchanged: `'top' \| 'right' \| 'bottom' \| 'left'`. |
| `SheetHeader` / `ZoruSheetHeader` | `SheetHeader` | `pure-import-swap` | |
| `SheetFooter` / `ZoruSheetFooter` | `SheetFooter` | `pure-import-swap` | |
| `SheetTitle` / `ZoruSheetTitle` | `SheetTitle` | `pure-import-swap` | |
| `SheetDescription` / `ZoruSheetDescription` | `SheetDescription` | `pure-import-swap` | |
| `SheetOverlay` | `SheetOverlay` | `pure-import-swap` | |

### Accordion family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Accordion` / `ZoruAccordion` | `Accordion` | `pure-import-swap` | |
| `ZoruAccordionItem` / `AccordionItem` | `AccordionItem` | `rename` | Drop the `Zoru` prefix. |
| `ZoruAccordionTrigger` / `AccordionTrigger` | `AccordionTrigger` | `rename` | |
| `ZoruAccordionContent` / `AccordionContent` | `AccordionContent` | `rename` | |
| `ZoruAccordion03` / `ZoruAccordion03Item` / `ZoruAccordion03Trigger` / `ZoruAccordion03Content` | Not in 20ui | `restructure` | Accordion03 is a ZoruUI-specific variant. Rebuild using 20ui `Accordion`+`AccordionItem`+`AccordionTrigger`+`AccordionContent` with custom styling. |
| `ZoruCollapsible` / `ZoruCollapsibleTrigger` / `ZoruCollapsibleContent` | `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent` | `rename` | All from `disclosure.tsx`. |

### Avatar family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Avatar` / `ZoruAvatar` | `Avatar` | `restructure` | 20ui `Avatar` wraps the Twenty avatar; props are `name`, `src`, `size`, `shape` (not `AvatarImage`/`AvatarFallback` children). Remove child sub-components. |
| `ZoruAvatarImage` / `AvatarImage` | Remove | `restructure` | Replaced by the `src` prop on `Avatar`. |
| `ZoruAvatarFallback` / `AvatarFallback` | Remove | `restructure` | Replaced by the `name` prop on `Avatar` (generates initials). |
| `AvatarGroup` | `AvatarGroup` | `pure-import-swap` | |

### Badge family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Badge` / `ZoruBadge` | `Badge` | `restructure` | Prop shape changes: ZoruUI uses `zoruBadgeVariants` cva class. 20ui `Badge` uses `tone: BadgeTone` + `kind: 'soft' \| 'solid' \| 'outline'`. Map old `variant` → `tone`+`kind`. |
| `zoruBadgeVariants` | Remove | `restructure` | Replace with `tone`+`kind` props. |
| `Tag` | `Tag` | `pure-import-swap` | New in 20ui `badge.tsx`. |
| `Dot` | `Dot` | `pure-import-swap` | New in 20ui `badge.tsx`. |

### Button family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Button` / `ZoruButton` | `Button` | `pure-import-swap` | Variant names may differ slightly (`zoruButtonVariants` vs `ButtonVariant`). Check: `'default' \| 'primary' \| 'secondary' \| 'ghost' \| 'danger' \| 'link'`. |
| `zoruButtonVariants` | Remove | `restructure` | Replace cva usage with `variant` prop directly. |
| `IconButton` | `IconButton` | `pure-import-swap` | New in 20ui `button.tsx`. |
| `ButtonGroup` | `ButtonGroup` | `pure-import-swap` | New in 20ui `button.tsx`. |
| `ZoruBouncyToggle` | Not in 20ui | `restructure` | Use `Switch` from 20ui `choice.tsx` instead, or keep as a one-off if animation is critical. |

### Input / Field family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Input` / `ZoruInput` | `Input` | `pure-import-swap` | Imported from `field.tsx`. Same ref-forward pattern; gains optional `size: 'sm' \| 'md' \| 'lg'`. |
| `Textarea` / `ZoruTextarea` | `Textarea` | `pure-import-swap` | From `field.tsx`. |
| `Label` / `ZoruLabel` | — | `restructure` | 20ui uses the `Field` compound (`<Field label="…">`) to attach labels. Bare `Label` is not exported; wrap inputs in `<Field>` instead. |
| `Field` | `Field` | `already-20ui` | The 20ui field wrapper (label + helper + error) — use this instead of manual `<label>` + `<Input>` pairs. |

### Switch / Checkbox / Radio family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Switch` / `ZoruSwitch` | `Switch` | `pure-import-swap` | From `choice.tsx`. |
| `Checkbox` / `ZoruCheckbox` | `Checkbox` | `pure-import-swap` | From `choice.tsx`. |
| `RadioGroup` / `ZoruRadioGroup` | `RadioGroup` | `pure-import-swap` | From `choice.tsx`. |
| `ZoruRadioGroupItem` | `Radio` | `rename` | Individual radio item is `Radio` in 20ui `choice.tsx`. |
| `ZoruRadioCard` | Not in 20ui | `restructure` | Use `Card` with a `Radio` inside, or a `SegmentedControl` if it's a visual switcher. |

### Alert family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Alert` / `ZoruAlert` | `Alert` | `restructure` | 20ui `Alert` (from `feedback.tsx`) uses `tone: FeedbackTone` instead of variant classes. Remove `AlertTitle`/`AlertDescription` sub-components — 20ui `Alert` takes `title` + `description` props. |
| `ZoruAlertTitle` / `AlertTitle` | Remove | `restructure` | Pass as `title` prop to `Alert`. |
| `ZoruAlertDescription` / `AlertDescription` | Remove | `restructure` | Pass as `description` prop to `Alert`. |
| `Callout` | `Callout` | `already-20ui` | New in 20ui `feedback.tsx`. |

### Skeleton / Progress family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Skeleton` / `ZoruSkeleton` | `Skeleton` | `pure-import-swap` | From `loading.tsx`. |
| `Progress` / `ZoruProgress` | `Progress` | `pure-import-swap` | Now in `loading.tsx`. Same `tone`/`size` API. Breadcrumb & Progress are newly present this phase. |
| `ProgressRing` | `ProgressRing` | `already-20ui` | New in 20ui `loading.tsx`. |
| `Spinner` | `Spinner` | `already-20ui` | New in 20ui `loading.tsx`. |

### Toast / Notification family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `ZoruToastProvider` / `ZoruToaster` | `ToastProvider` / `Toaster` | `rename` | Drop the `Zoru` prefix. |
| `useZoruToast` | `useToast` | `rename` | Imperative toast hook. |
| `zoruToast` | `useToast().toast(...)` | `restructure` | The standalone function is replaced by the hook return. Call `useToast()` to get `toast(options)`. |
| `ZoruSonner` / `zoruSonnerToast` | Not in 20ui | `restructure` | 20ui uses its own `ToastProvider` / `useToast`. Remove Sonner references; wire `<ToastProvider>` in layout and call `useToast()` at the call site. |
| `ZoruToast` / `ZoruToastViewport` / `ZoruToastTitle` / `ZoruToastDescription` / `ZoruToastAction` / `ZoruToastClose` | Remove | `restructure` | 20ui Toast is imperative-only (`useToast`). No JSX sub-components. |

### Command family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `ZoruCommand` | `Command` | `rename` | |
| `ZoruCommandDialog` | `CommandDialog` | `rename` | |
| `ZoruCommandInput` | `CommandInput` | `rename` | |
| `ZoruCommandList` | `CommandList` | `rename` | |
| `ZoruCommandEmpty` | `CommandEmpty` | `rename` | |
| `ZoruCommandGroup` | `CommandGroup` | `rename` | |
| `ZoruCommandSeparator` | `CommandSeparator` | `rename` | |
| `ZoruCommandItem` | `CommandItem` | `rename` | |
| `ZoruCommandShortcut` | `CommandShortcut` | `rename` | |

### Separator / Kbd family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Separator` / `ZoruSeparator` | `Separator` | `pure-import-swap` | From `misc.tsx`. |
| `ZoruKbd` | `Kbd` | `rename` | From `misc.tsx`. |

### Form family

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `Form` / `FormItem` / `FormLabel` / `FormControl` / `FormDescription` / `FormMessage` / `FormField` / `useFormField` | Same names | `pure-import-swap` | 20ui `form.tsx` re-exports the same react-hook-form wrappers. |

### Misc / not migrated

| ZoruUI / shadcn symbol | 20ui symbol | Swap type | Notes |
|---|---|---|---|
| `ZoruDock` / `ZoruDockIcon` | `Dock` / `DockIcon` | `rename` | From `dock.tsx`. |
| `ScrollArea` / `ZoruScrollArea` | `ScrollArea` | `pure-import-swap` | From `scrollarea.tsx`. |
| `ZoruScrollBar` | `ScrollBar` | `rename` | |
| `ZoruResizablePanelGroup` / `ZoruResizablePanel` / `ZoruResizableHandle` | `ResizablePanelGroup` / `ResizablePanel` / `ResizableHandle` | `rename` | From `resizable.tsx`. |
| `EmptyState` / `ZoruEmptyState` | `EmptyState` | `pure-import-swap` | From `feedback.tsx`. |
| `Slider` | `Slider` | `pure-import-swap` | From `slider.tsx`. |
| `TagPicker` / `ZoruTagPicker` | `TagPicker` | `pure-import-swap` | From `tagpicker.tsx`. |
| `DatePicker` / `ZoruDatePicker` | `DatePicker` | `pure-import-swap` | From `datepicker.tsx`. |
| `ZoruDateRangePicker` | `DateRangePicker` | `rename` | From `daterange.tsx`. |
| `Calendar` / `ZoruCalendar` | `Calendar` | `pure-import-swap` | |
| `ZoruColorPicker` | `ColorPicker` | `rename` | From `colorpicker.tsx`. |
| `ZoruIconPicker` | `IconPicker` | `rename` | From `iconpicker.tsx`. |
| `SegmentedControl` | `SegmentedControl` | `already-20ui` | From `segmented.tsx`. Use instead of tab-strip patterns. |
| `ZoruShell` / `ZoruAppRail` / `ZoruAppSidebar` / `ZoruHeader` / `ZoruHomeShell` | `Shell` / `AppRail` / `AppSidebar` / `Header` / `HomeShell` | `rename` | From `shell.tsx`. Drop the `Zoru` prefix. |
| `PageHeader` / `ZoruPageHeader` / `ZoruPageHeading` / `ZoruPageEyebrow` / `ZoruPageTitle` / `ZoruPageDescription` / `ZoruPageActions` | `PageHeader` / `PageHeading` / `PageEyebrow` / `PageTitle` / `PageDescription` / `PageActions` | `rename` | From `pageheader.tsx`. Drop the `Zoru` prefix. |
| `ZoruCarousel` / `ZoruCarouselItem` | `Carousel` / `CarouselItem` | `rename` | From `carousel.tsx`. |
| `ZoruMenubar` and sub-parts | `Menubar` + sub-parts (no `Zoru` prefix) | `rename` | From `menubar.tsx`. |
| `ZoruDrawer` and sub-parts | `Drawer` + sub-parts (no `Zoru` prefix) | `rename` | From `drawer.tsx`. |
| `ZoruChart` / `ZoruChartContainer` etc. | `Chart` / `ChartContainer` etc. | `rename` | From `chart.tsx`. |
| `ZoruActionSearchBar` | `ActionSearchBar` | `rename` | From `actionsearchbar.tsx`. |
| `ZoruUserDropdown` | `UserDropdown` | `rename` | From `userdropdown.tsx`. |
| `ZoruNotificationPopover` | `NotificationPopover` | `rename` | From `notificationpopover.tsx`. |
| `ZoruFileUploadCard` / `ZoruFileCardCollections` / `ZoruFilesPage` etc. | Not in 20ui | `restructure` | ZoruUI file components are for the ZoruUI files module. In SabCRM, file inputs must use `<SabFilePicker>` / `<SabFilePickerButton>` from `@/components/sabfiles`. Do not port these. |
| `SabNodeWaterLoader` / `SabNodeWaterLoaderScreen` | `WaterLoader` (from `loaders.tsx`) | `rename` | 20ui has its own loader family. |
| `ZoruWaterLoader` | `WaterLoader` | `rename` | |
| `ZoruHeroPill` / `ZoruStarIcon` | From `marketing.tsx` | `restructure` | Check `marketing.tsx` exports; may not have direct 20ui equivalents. |
| `ZoruLimelightNav` | Not in 20ui | `restructure` | Use `SegmentedControl` or a custom nav rail built from `Button`. |
| `RouteComingSoon` | From `extras.tsx` | `rename` | |
| `ZoruDynamicSelector` | `DynamicSelector` | `rename` | From `extras.tsx` or `combobox.tsx`. Verify against actual exports. |
| `ZoruFilePicker` / `ZoruFileInput` | Use `SabFilePicker` from `@/components/sabfiles` | `restructure` | Per the SabFiles policy, never expose free-text URLs or ZoruUI file pickers in new code. |
| Sidebar (ZoruUI) — `useSidebar`, `SidebarProvider`, `Sidebar`, etc. | `SidebarProvider`, `Sidebar`, etc. | `pure-import-swap` | From `sidebar.tsx`. Names are identical. |

---

## 3. How to migrate a file — checklist

Work through each step in order. Steps 1-4 are mechanical; step 5 requires judgment.

### Step 1 — Swap the import path

```diff
- import { Button, Card, Badge } from '@/components/zoruui';
- import { Select, SelectItem } from '@/components/ui/select';
+ import { Button, Card, Badge, Select, SelectItem } from '@/components/sabcrm/20ui';
```

A single import from `@/components/sabcrm/20ui` replaces both `@/components/zoruui` and
`@/components/ui/*` for every symbol listed in this table.

### Step 2 — Apply renames from the table above

For `rename` rows, update only the symbol names; no prop changes are needed.

```diff
- <ZoruTableHeader>  →  <THead>
- <ZoruTableRow>     →  <Tr>
- <ZoruTableHead>    →  <Th>
- <ZoruTableCell>    →  <Td>
- <ZoruKbd>          →  <Kbd>
```

For `Zoru`-prefixed transitional aliases (e.g. `ZoruButton`, `ZoruDialog`), simply
drop the `Zoru` prefix; everything else stays the same.

### Step 3 — Handle restructure rows

For each `restructure` entry, read the Notes column and apply the prop-level change:

- **Card**: rename `CardContent` → `CardBody`; replace `zoruCardVariants(...)` cva call with the `variant` prop.
- **Badge**: replace `variant` string + `zoruBadgeVariants` with `tone` + `kind`.
- **Alert**: collapse `<Alert><AlertTitle>…</AlertTitle><AlertDescription>…</AlertDescription></Alert>` to `<Alert tone="…" title="…" description="…" />`.
- **Avatar**: replace the `<Avatar><AvatarImage src={…} /><AvatarFallback>{initials}</AvatarFallback></Avatar>` compound with `<Avatar src={…} name={fullName} size="md" />`.
- **Toast**: remove `ZoruToastProvider` from layout, add `<ToastProvider>`; replace `zoruToast({…})` call sites with `const { toast } = useToast(); toast({…})`.
- **Select (props-based)**: rename `Select` → `SelectField`; props are identical.
- **Tabs (props-based)**: rename `Tabs` → `TabsBar`; props are identical.
- **Tooltip (props-based)**: rename `Tooltip` → `SimpleTooltip`; props are identical.
- **Label**: wrap the `<Input>` in `<Field label="…">` and delete the standalone `<Label>`.
- **Button**: remove any `zoruButtonVariants(...)` class-composition calls; set the `variant` prop directly on `<Button>`.

### Step 4 — Remove now-redundant per-page CSS imports

If the file imports a ZoruUI component-level CSS file directly (e.g. `import '@/components/zoruui/button.css'`), delete that import. 20ui loads its own scoped CSS automatically when the component module is first imported.

If the file imports a surface-level CSS override (e.g. `surface-list.css`, `surface-forms.css`), keep it only if it contains rules specific to that page. Token overrides that are now covered by `tokens.css` / `tokens-crm.css` / `tokens-global.css` should be removed.

### Step 5 — Replace visual inline styles with token classes

Replace hard-coded colour/spacing inline styles that duplicate 20ui tokens with the
appropriate CSS custom property or utility class:

```diff
- style={{ color: '#6b7280', fontSize: 12 }}
+ className="u-text-secondary u-text-sm"
```

Keep data-driven inline styles (e.g. `style={{ width: item.percent + '%' }}`) — these
are correct and intentional.

### Step 6 — Verify the `.ui20` scope wrapper

Every 20ui component must render inside a subtree that carries `className="ui20"` (or
`className="ui20 sabcrm-twenty"` for CRM pages). Check that the nearest layout or
page component provides this wrapper. Do not add it to individual leaf components.

---

## 4. What does NOT go through 20ui

| Concern | Where to import from |
|---|---|
| File inputs / pickers | `@/components/sabfiles` — `SabFilePicker`, `SabFilePickerButton`, `SabFileUrlInput`, `SabFileToFileButton` |
| Chart containers (SabNode main shell) | `@/components/zoruui` — `ChartContainer`, `ChartTooltip` (ZoruUI chart is still canonical outside CRM) |
| Sidebar chrome (non-CRM) | `@/components/zoruui` — `ZoruShell`, `ZoruAppRail` |
| Form primitives (react-hook-form) | `@/components/sabcrm/20ui` — `Form`, `FormField`, `FormItem`, etc. (20ui re-exports these) |
| Landing / marketing blocks | `@/components/zoruui` unless the page is inside `/sabcrm` |

---

## 5. Quick decision: which Select to use?

```
Do you have a static/dynamic options array and want a one-liner?
  → SelectField (props-based, 20ui select.tsx)

Do you need JSX children, Radix typeahead, full ARIA listbox, or shadcn compat?
  → Select + SelectTrigger + SelectContent + SelectItem (Radix compound, 20ui select-radix.tsx)
```

Same logic applies to **Tabs** (`TabsBar` vs `Tabs`+`TabsList`) and
**Tooltip** (`SimpleTooltip` vs `Tooltip`+`TooltipProvider`+`TooltipTrigger`+`TooltipContent`).
