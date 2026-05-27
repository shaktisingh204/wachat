# ZoruUI-Only Migration — Agent Guide

**Goal:** every TSX file in `src/` (except landing/marketing) uses ONLY ZoruUI components and aesthetics.

## What to replace

### Imports
- `@/components/ui/*` → `@/components/zoruui`
- `@/components/clay/*` → `@/components/zoruui`
- `@/components/sab-ui/*` → `@/components/zoruui`
- `@/components/wabasimplify/*` → if shared primitive, port it to a ZoruUI usage pattern; otherwise refactor consumer to use ZoruUI primitives directly.

### Tailwind color tokens → ZoruUI semantic tokens
- `bg-white`, `bg-gray-50`, `bg-zinc-50` → `bg-zoru-bg`
- `bg-gray-100`, `bg-zinc-100`, `bg-slate-50/100` → `bg-zoru-surface-2`
- `border-gray-200`, `border-zinc-200`, `border-slate-200` → `border-zoru-line`
- `text-gray-900`, `text-zinc-900`, `text-black` → `text-zoru-ink`
- `text-gray-500/600`, `text-zinc-500/600`, `text-muted-foreground` → `text-zoru-ink-muted`
- `text-gray-400`, `text-zinc-400` → `text-zoru-ink-subtle`
- Brand accents (`bg-blue-500`, `text-blue-600` etc.) used as primary CTA → `bg-zoru-ink text-white` for buttons or use `<Button>` from zoruui.
- `bg-red-*`, `text-red-*` for destructive → `bg-zoru-danger`, `text-zoru-danger-ink`
- `bg-green-*` for success → `bg-zoru-success`, `text-zoru-success-ink`
- `bg-amber-*`/`bg-yellow-*` for warning → `bg-zoru-warning`, `text-zoru-warning-ink`
- Hard-coded hex/rgb colors in inline styles → swap to a semantic class
- `shadow-md/lg/xl` → use `shadow-[var(--zoru-shadow-md)]` etc., or omit (Card already has shadow)
- Rounded radii: `rounded-md/lg/xl` → `rounded-[var(--zoru-radius)]` or use Card

### Layout restructuring (when feasible)
- Page wrappers using `<div className="container ...">` → use `<PageHeader>`, `<ZoruPageHeading>`, `<ZoruPageTitle>`, `<ZoruPageDescription>` from zoruui.
- Custom card divs (`<div className="bg-white border rounded-lg p-6">`) → `<Card className="p-6">` from zoruui.
- Custom badges → `<Badge variant=...>` from zoruui.
- Custom modal/dialog primitives → `<Dialog>` / `<ZoruDialogContent>` from zoruui.

## What NOT to change
- DO NOT modify anything under:
  - `src/components/landing*` (any landing/marketing components)
  - `src/components/landing-3d`, `src/components/landing-v2`
  - `src/app/(landing routes)` — about-us, blog, careers, contact, customers (marketing pages), enterprise, features, partners, pricing, privacy-policy, products, resources, terms-and-conditions, sign (marketing), web, webinar
- DO NOT touch the ZoruUI source itself in `src/components/zoruui/**`.
- DO NOT remove a re-export shim if other files still depend on it.
- DO NOT touch files outside your assigned folder unless you fix an import that broke.
- DO NOT change runtime behavior — keep all logic, state, server-action calls intact. ONLY swap UI imports and visual classes.

## How to work

1. List files in your assigned folder containing non-Zoru imports:
   ```
   grep -rl "@/components/ui\|@/components/clay\|@/components/sab-ui\|@/components/wabasimplify" <folder> --include="*.tsx" --include="*.ts"
   ```
2. For each file:
   - Replace the imports per the mapping above.
   - Replace raw Tailwind color tokens per the mapping above.
   - If a component has no clean ZoruUI equivalent, log it to `/Users/harshkhandelwal/Downloads/sabnode/.zoruui-migration/unreplaceables.log` with the file path, component name, and why, then leave it alone for now.
3. After each file is migrated, append a line to `/Users/harshkhandelwal/Downloads/sabnode/.zoruui-migration/progress.log` with `DONE <file>` so we can resume if interrupted.
4. Do NOT run `npm run build` or `tsc` (memory-intensive on this monorepo). The diff is your verification.

## ZoruUI component mapping cheat-sheet

| Legacy | ZoruUI |
| --- | --- |
| `Button` from ui | `Button` from zoruui (same name) |
| `Card, CardContent, CardHeader, CardTitle` | `Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle` (Card stays bare) |
| `Input, Textarea, Label` | same names, from zoruui |
| `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter` | `Dialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, ZoruDialogDescription, ZoruDialogFooter` |
| `Sheet, SheetContent, SheetHeader, ...` | `Sheet, ZoruSheetContent, ZoruSheetHeader, ZoruSheetTitle, ZoruSheetDescription, ZoruSheetFooter` |
| `Tabs, TabsList, TabsTrigger, TabsContent` | `Tabs, ZoruTabsList, ZoruTabsTrigger, ZoruTabsContent` |
| `Select, SelectTrigger, SelectContent, SelectItem, SelectValue` | `Select, ZoruSelectTrigger, ZoruSelectContent, ZoruSelectItem, ZoruSelectValue` |
| `DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem` | `DropdownMenu, ZoruDropdownMenuTrigger, ZoruDropdownMenuContent, ZoruDropdownMenuItem` |
| `Avatar, AvatarImage, AvatarFallback` | `Avatar, ZoruAvatarImage, ZoruAvatarFallback` (AvatarImage/AvatarFallback also re-exported for compatibility) |
| `Badge` | `Badge` (use `variant="ghost" | "success" | "danger" | "warning"`) |
| `Skeleton, Separator, Switch, Checkbox, RadioGroup, Slider, Progress, Tooltip` | same names from zoruui |
| `Popover, PopoverTrigger, PopoverContent` | `Popover, ZoruPopoverTrigger, ZoruPopoverContent` |
| `Alert, AlertTitle, AlertDescription` | `Alert, ZoruAlertTitle, ZoruAlertDescription` |
| `Table, TableHead, TableHeader, TableBody, TableRow, TableCell` | `Table, ZoruTableHead, ZoruTableHeader, ZoruTableBody, ZoruTableRow, ZoruTableCell` |
| `Accordion, AccordionItem, AccordionTrigger, AccordionContent` | `Accordion, ZoruAccordionItem, ZoruAccordionTrigger, ZoruAccordionContent` |
| `useToast / toast` | `useZoruToast / zoruToast` |
| `cn` helper | `cn` from zoruui |
| `PageHeader` shell | `PageHeader, ZoruPageHeading, ZoruPageTitle, ZoruPageDescription` |

## Import line patterns

Replace:
```ts
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
```

With consolidated zoruui:
```ts
import { Button, Card, ZoruCardContent } from "@/components/zoruui";
```

Always consolidate ZoruUI imports onto a single import line per file.
