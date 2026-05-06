#!/usr/bin/env node
/**
 * Zoru codemod (safe variant) — for the remaining CRM Clay pages.
 *
 * Only does identifier renames + import consolidation. Does NOT touch:
 *   - leading=/trailing= props (those need hand work)
 *   - variant="obsidian|pill|rose" (would leave half-broken attrs)
 *   - bg-{color}-50 etc. (CSS overrides handle these inside .zoruui)
 *
 * Result: tsc-clean source-level Clay→Zoru import swap, with the
 * Zoru visual layer kicking in via the .zoruui scope class. Any
 * remaining prop API differences are fixed up by the per-file tsc
 * pass after.
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function collect(input) {
  const stat = fs.statSync(input);
  if (stat.isFile()) return input.endsWith('.tsx') ? [input] : [];
  if (!stat.isDirectory()) return [];
  const out = [];
  for (const entry of fs.readdirSync(input, { withFileTypes: true })) {
    const sub = path.join(input, entry.name);
    if (entry.isDirectory()) out.push(...collect(sub));
    else if (entry.isFile() && entry.name === 'page.tsx') out.push(sub);
  }
  return out;
}

const files = args.flatMap(collect);

// Shadcn → Zoru rename map for module path → component names.
const SHADCN_RENAMES = {
  Button: 'ZoruButton',
  Input: 'ZoruInput',
  Textarea: 'ZoruTextarea',
  Label: 'ZoruLabel',
  Skeleton: 'ZoruSkeleton',
  Switch: 'ZoruSwitch',
  Checkbox: 'ZoruCheckbox',
  Avatar: 'ZoruAvatar',
  AvatarImage: 'ZoruAvatarImage',
  AvatarFallback: 'ZoruAvatarFallback',
  Separator: 'ZoruSeparator',
  Card: 'ZoruCard',
  CardHeader: 'ZoruCardHeader',
  CardTitle: 'ZoruCardTitle',
  CardDescription: 'ZoruCardDescription',
  CardContent: 'ZoruCardContent',
  CardFooter: 'ZoruCardFooter',
  Alert: 'ZoruAlert',
  AlertTitle: 'ZoruAlertTitle',
  AlertDescription: 'ZoruAlertDescription',
  Badge: 'ZoruBadge',
  Table: 'ZoruTable',
  TableHeader: 'ZoruTableHeader',
  TableBody: 'ZoruTableBody',
  TableFooter: 'ZoruTableFooter',
  TableRow: 'ZoruTableRow',
  TableHead: 'ZoruTableHead',
  TableCell: 'ZoruTableCell',
  TableCaption: 'ZoruTableCaption',
  Dialog: 'ZoruDialog',
  DialogTrigger: 'ZoruDialogTrigger',
  DialogContent: 'ZoruDialogContent',
  DialogHeader: 'ZoruDialogHeader',
  DialogFooter: 'ZoruDialogFooter',
  DialogTitle: 'ZoruDialogTitle',
  DialogDescription: 'ZoruDialogDescription',
  DialogClose: 'ZoruDialogClose',
  AlertDialog: 'ZoruAlertDialog',
  AlertDialogTrigger: 'ZoruAlertDialogTrigger',
  AlertDialogContent: 'ZoruAlertDialogContent',
  AlertDialogHeader: 'ZoruAlertDialogHeader',
  AlertDialogFooter: 'ZoruAlertDialogFooter',
  AlertDialogTitle: 'ZoruAlertDialogTitle',
  AlertDialogDescription: 'ZoruAlertDialogDescription',
  AlertDialogAction: 'ZoruAlertDialogAction',
  AlertDialogCancel: 'ZoruAlertDialogCancel',
  Sheet: 'ZoruSheet',
  SheetTrigger: 'ZoruSheetTrigger',
  SheetContent: 'ZoruSheetContent',
  SheetHeader: 'ZoruSheetHeader',
  SheetFooter: 'ZoruSheetFooter',
  SheetTitle: 'ZoruSheetTitle',
  SheetDescription: 'ZoruSheetDescription',
  Popover: 'ZoruPopover',
  PopoverTrigger: 'ZoruPopoverTrigger',
  PopoverContent: 'ZoruPopoverContent',
  DropdownMenu: 'ZoruDropdownMenu',
  DropdownMenuTrigger: 'ZoruDropdownMenuTrigger',
  DropdownMenuContent: 'ZoruDropdownMenuContent',
  DropdownMenuItem: 'ZoruDropdownMenuItem',
  DropdownMenuLabel: 'ZoruDropdownMenuLabel',
  DropdownMenuSeparator: 'ZoruDropdownMenuSeparator',
  DropdownMenuCheckboxItem: 'ZoruDropdownMenuCheckboxItem',
  DropdownMenuRadioItem: 'ZoruDropdownMenuRadioItem',
  DropdownMenuRadioGroup: 'ZoruDropdownMenuRadioGroup',
  DropdownMenuShortcut: 'ZoruDropdownMenuShortcut',
  DropdownMenuSubTrigger: 'ZoruDropdownMenuSubTrigger',
  DropdownMenuSubContent: 'ZoruDropdownMenuSubContent',
  DropdownMenuSub: 'ZoruDropdownMenuSub',
  Select: 'ZoruSelect',
  SelectTrigger: 'ZoruSelectTrigger',
  SelectValue: 'ZoruSelectValue',
  SelectContent: 'ZoruSelectContent',
  SelectItem: 'ZoruSelectItem',
  SelectGroup: 'ZoruSelectGroup',
  SelectLabel: 'ZoruSelectLabel',
  SelectSeparator: 'ZoruSelectSeparator',
  RadioGroup: 'ZoruRadioGroup',
  RadioGroupItem: 'ZoruRadioGroupItem',
  Tooltip: 'ZoruTooltip',
  TooltipTrigger: 'ZoruTooltipTrigger',
  TooltipContent: 'ZoruTooltipContent',
  TooltipProvider: 'ZoruTooltipProvider',
  ScrollArea: 'ZoruScrollArea',
  Accordion: 'ZoruAccordion',
  AccordionItem: 'ZoruAccordionItem',
  AccordionTrigger: 'ZoruAccordionTrigger',
  AccordionContent: 'ZoruAccordionContent',
  Progress: 'ZoruProgress',
  // NOTE: Calendar intentionally NOT renamed — lucide-react also exports
  // a Calendar icon and a blanket rename clobbers both.
  DatePicker: 'ZoruDatePicker',
  // NOTE: Tabs family intentionally NOT renamed — there is no ZoruTabs;
  // the no-tab-ui directive says use segmented buttons instead. Pages
  // using Tabs need hand conversion. We strip the import below so the
  // page at least compiles when Tabs is unused after edits.
};

const CLAY_RENAMES = {
  ClayCard: 'ZoruCard',
  ClayButton: 'ZoruButton',
  ClayBadge: 'ZoruBadge',
  ClayInput: 'ZoruInput',
  ClayLabel: 'ZoruLabel',
  ClayTextarea: 'ZoruTextarea',
  ClaySelect: 'ZoruSelect',
  ClaySwitch: 'ZoruSwitch',
  ClayBreadcrumbs: 'ZoruBreadcrumb',
  ClaySectionHeader: 'ZoruPageHeader',
};

let migrated = 0;

for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  const original = s;

  // Drop the sentinel injected by the earlier codemod.
  s = s.replace(/import\s*\{\s*cn\s+as\s+_zoruCn\s*\}\s*from\s*['"]@\/components\/zoruui['"];?\s*\n?/g, '');
  s = s.replace(/^\s*void\s+_zoruCn;\s*\n?/gm, '');

  // Collect zoru imports we need to add as we transform.
  const zoruNeeded = new Set();

  // Replace shadcn ui imports with the renamed identifiers; track names.
  // Skip Tabs (no ZoruTabs exists per the no-tab-ui directive). For
  // anything else we don't have an explicit rename for, skip it too —
  // a `Zoru${name}` fallback risks importing a non-existent symbol
  // and breaking the build.
  s = s.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]@\/components\/ui\/[\w-]+['"];?/g,
    (full, body) => {
      const names = body.split(',').map((n) => n.trim()).filter(Boolean);
      const SKIP_NAMES = new Set([
        'Tabs',
        'TabsList',
        'TabsTrigger',
        'TabsContent',
      ]);
      const remap = [];
      const passthrough = [];
      for (const name of names) {
        if (SKIP_NAMES.has(name)) continue; // drop entirely
        if (SHADCN_RENAMES[name]) {
          remap.push(SHADCN_RENAMES[name]);
          zoruNeeded.add(SHADCN_RENAMES[name]);
        } else {
          // Unknown shadcn export — leave it as the original import. Re-emit.
          passthrough.push(name);
        }
      }
      if (passthrough.length === 0) return '';
      // Re-emit a single passthrough import line for the unknowns.
      // Pull the source path from the original.
      const srcMatch = full.match(/from\s*['"]([^'"]+)['"]/);
      const srcPath = srcMatch ? srcMatch[1] : '';
      return `import { ${passthrough.join(', ')} } from '${srcPath}';`;
    },
  );

  // Same for Clay.
  s = s.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]@\/components\/clay['"];?/g,
    (_, body) => {
      const names = body.split(',').map((n) => n.trim()).filter(Boolean);
      for (const name of names) {
        const renamed = CLAY_RENAMES[name] || name;
        if (renamed.startsWith('Zoru')) zoruNeeded.add(renamed);
      }
      return '';
    },
  );

  // useToast → useZoruToast.
  s = s.replace(
    /import\s*\{[^}]*\buseToast\b[^}]*\}\s*from\s*['"]@\/hooks\/use-toast['"];?/g,
    () => {
      zoruNeeded.add('useZoruToast');
      return '';
    },
  );
  s = s.replace(/\buseToast\b/g, 'useZoruToast');

  // Replace JSX usage of identifiers — only inside JSX element opens
  // (`<Name` / `</Name`). Restricting to `<\\b${from}` avoids the
  // false-positive of clobbering a lucide icon with the same name as
  // a shadcn component (e.g. lucide `Calendar` icon vs shadcn
  // Calendar component — they're imported from different modules but
  // share a name).
  for (const [from, to] of Object.entries(SHADCN_RENAMES)) {
    s = s.replace(new RegExp(`<${from}(?=\\s|/>|>)`, 'g'), `<${to}`);
    s = s.replace(new RegExp(`</${from}>`, 'g'), `</${to}>`);
  }
  for (const [from, to] of Object.entries(CLAY_RENAMES)) {
    s = s.replace(new RegExp(`<${from}(?=\\s|/>|>)`, 'g'), `<${to}`);
    s = s.replace(new RegExp(`</${from}>`, 'g'), `</${to}>`);
  }

  // Add the consolidated zoruui import at the top of the file. We
  // insert AFTER any leading 'use client' directive but BEFORE
  // anything else (including other imports — multi-line imports
  // can confuse line-by-line insertion logic, so prepending is
  // safest).
  if (zoruNeeded.size > 0) {
    const importBlock = `import { ${Array.from(zoruNeeded).sort().join(', ')} } from '@/components/zoruui';\n`;
    const useClientMatch = s.match(/^(['"]use [\w-]+['"];?\s*\n)/);
    if (useClientMatch) {
      s = useClientMatch[0] + importBlock + s.slice(useClientMatch[0].length);
    } else {
      s = importBlock + s;
    }
  }

  // Collapse multiple blank lines.
  s = s.replace(/\n{3,}/g, '\n\n');

  if (s !== original) {
    fs.writeFileSync(file, s, 'utf8');
    migrated++;
  }
}

console.log(`Safe codemod: migrated=${migrated}/${files.length}`);
