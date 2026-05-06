#!/usr/bin/env node
/**
 * Zoru codemod — bulk-migrates Clay/legacy `page.tsx` to ZoruUI.
 *
 * Limitations: this is a regex-based pass, not an AST transform. It handles
 * the ~80% of mechanical cases (imports, simple component renames, class
 * tokens, react-icons → lucide). Files with exotic patterns may need a
 * follow-up hand fix — `tsc` will catch those.
 *
 * Run: node scripts/zoru-codemod.mjs <glob | dir>
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node zoru-codemod.mjs <dir-or-file> [more...]');
  process.exit(1);
}

// Recursively gather page.tsx files under each input.
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

// react-icons/lu → lucide-react. Most lu icons just drop the "Lu" prefix and
// match a lucide name. A handful diverge — we map the common ones explicitly.
const LU_RENAME = {
  LuLoaderCircle: 'LoaderCircle',
  LuLoader: 'Loader',
  LuCircleAlert: 'CircleAlert',
  LuCircleCheck: 'CircleCheck',
  LuCircleX: 'CircleX',
  LuCirclePlus: 'CirclePlus',
  LuCirclePause: 'CirclePause',
  LuTriangleAlert: 'TriangleAlert',
  LuMessagesSquare: 'MessagesSquare',
  LuMessageSquare: 'MessageSquare',
  LuArrowUpRight: 'ArrowUpRight',
  LuArrowDown: 'ArrowDown',
  LuArrowLeft: 'ArrowLeft',
  LuArrowRight: 'ArrowRight',
  LuChevronDown: 'ChevronDown',
  LuChevronUp: 'ChevronUp',
  LuChevronLeft: 'ChevronLeft',
  LuChevronRight: 'ChevronRight',
  LuTrendingUp: 'TrendingUp',
  LuTrendingDown: 'TrendingDown',
  LuRefreshCw: 'RefreshCw',
  LuShoppingBag: 'ShoppingBag',
  LuShoppingCart: 'ShoppingCart',
  LuFileSpreadsheet: 'FileSpreadsheet',
  LuFileCheck: 'FileCheck',
  LuExternalLink: 'ExternalLink',
  LuGitBranch: 'GitBranch',
  LuGitFork: 'GitFork',
  LuShieldAlert: 'ShieldAlert',
  LuChartBar: 'BarChart3',
  LuBarChart: 'BarChart3',
  LuShield: 'Shield',
  LuLock: 'Lock',
  LuLaptop: 'Laptop',
  LuLogOut: 'LogOut',
  LuSave: 'Save',
  LuKey: 'Key',
  LuBell: 'Bell',
  LuEye: 'Eye',
  LuEyeOff: 'EyeOff',
  LuMail: 'Mail',
  LuAtSign: 'AtSign',
  LuUser: 'User',
  LuUserPlus: 'UserPlus',
  LuUsers: 'Users',
  LuSmartphone: 'Smartphone',
  LuPhone: 'Phone',
  LuBuilding2: 'Building2',
  LuAppWindow: 'AppWindow',
  LuActivity: 'Activity',
  LuBan: 'Ban',
  LuCircle: 'Circle',
  LuPlus: 'Plus',
  LuMinus: 'Minus',
  LuPencil: 'Pencil',
  LuEdit: 'Edit',
  LuTrash: 'Trash',
  LuTrash2: 'Trash2',
  LuEllipsis: 'MoreHorizontal',
  LuMoreHorizontal: 'MoreHorizontal',
  LuMoreVertical: 'MoreVertical',
  LuSearch: 'Search',
  LuFilter: 'Filter',
  LuCalendar: 'Calendar',
  LuClock: 'Clock',
  LuCheck: 'Check',
  LuX: 'X',
  LuCopy: 'Copy',
  LuDownload: 'Download',
  LuUpload: 'Upload',
  LuLink: 'Link',
  LuLinkIcon: 'Link',
  LuStar: 'Star',
  LuHeart: 'Heart',
  LuHome: 'Home',
  LuSettings: 'Settings',
  LuSettings2: 'Settings2',
  LuInbox: 'Inbox',
  LuSend: 'Send',
  LuPaperclip: 'Paperclip',
  LuFile: 'File',
  LuFileText: 'FileText',
  LuFolder: 'Folder',
  LuImage: 'Image',
  LuVideo: 'Video',
  LuMic: 'Mic',
  LuPlay: 'Play',
  LuPause: 'Pause',
  LuStop: 'Square',
  LuGlobe: 'Globe',
  LuMapPin: 'MapPin',
  LuMap: 'Map',
  LuBriefcase: 'Briefcase',
  LuCoins: 'Coins',
  LuCreditCard: 'CreditCard',
  LuReceipt: 'Receipt',
  LuTag: 'Tag',
  LuTags: 'Tags',
  LuFlag: 'Flag',
  LuBookmark: 'Bookmark',
  LuBookOpen: 'BookOpen',
  LuBookCopy: 'BookCopy',
  LuPuzzle: 'Puzzle',
  LuZap: 'Zap',
  LuRadio: 'Radio',
  LuRocket: 'Rocket',
  LuLayoutGrid: 'LayoutGrid',
  LuLayoutList: 'List',
  LuList: 'List',
  LuListChecks: 'ListChecks',
  LuPieChart: 'PieChart',
  LuLineChart: 'LineChart',
  LuTrash: 'Trash',
  LuArchive: 'Archive',
  LuLightbulb: 'Lightbulb',
  LuMegaphone: 'Megaphone',
  LuStore: 'Store',
  LuPercent: 'Percent',
  LuClipboard: 'Clipboard',
  LuClipboardCheck: 'ClipboardCheck',
  LuClipboardList: 'ClipboardList',
  LuDatabase: 'Database',
  LuServer: 'Server',
  LuServerCog: 'ServerCog',
  LuCode: 'Code2',
  LuCode2: 'Code2',
  LuTerminal: 'Terminal',
  LuGithub: 'Github',
  LuSlack: 'Slack',
  LuFacebook: 'Facebook',
  LuInstagram: 'Instagram',
  LuLinkedin: 'Linkedin',
  LuTwitter: 'Twitter',
  LuYoutube: 'Youtube',
  LuQrCode: 'QrCode',
  LuWebhook: 'Webhook',
  LuWifi: 'Wifi',
  LuWifiOff: 'WifiOff',
  LuSparkles: 'Sparkles',
  LuSun: 'Sun',
  LuMoon: 'Moon',
  LuMonitor: 'Monitor',
  LuPalette: 'Palette',
  LuType: 'Type',
  LuFontSize: 'Type',
  LuMessageCircle: 'MessageCircle',
  LuHelpCircle: 'HelpCircle',
  LuInfo: 'Info',
  LuAlert: 'AlertCircle',
  LuAlertCircle: 'AlertCircle',
  LuLogIn: 'LogIn',
  LuPower: 'Power',
};

const CLAY_TO_ZORU_COMPONENTS = {
  ClayBreadcrumbs: 'ZoruBreadcrumb',
  ClayCard: 'ZoruCard',
  ClayInput: 'ZoruInput',
  ClayLabel: 'ZoruLabel',
  ClayTextarea: 'ZoruTextarea',
  ClaySelect: 'ZoruSelect',
  ClaySwitch: 'ZoruSwitch',
  ClayCheckbox: 'ZoruCheckbox',
  ClayRadio: 'ZoruRadioGroup',
  ClayButton: 'ZoruButton',
  ClayBadge: 'ZoruBadge',
  ClayAvatar: 'ZoruAvatar',
  ClaySectionHeader: 'ZoruPageHeader',
  ClayListRow: 'div',
  ClayNotificationCard: 'ZoruCard',
  ClayChartCard: 'ZoruCard',
  ClayKpiCard: 'ZoruCard',
  ClayStatCard: 'ZoruCard',
  ClayDataTable: 'ZoruTable',
  ClayCalendar: 'ZoruCalendar',
  ClayDialog: 'ZoruDialog',
  ClayPopover: 'ZoruPopover',
  ClayDropdown: 'ZoruDropdownMenu',
  ClayTabs: 'div',
  ClayTabsList: 'div',
  ClayTab: 'button',
  ClayAlert: 'ZoruAlert',
  ClayProgress: 'ZoruProgress',
  ClaySkeleton: 'ZoruSkeleton',
  ClaySeparator: 'ZoruSeparator',
  ClayTooltip: 'ZoruTooltip',
  ClayScrollArea: 'ZoruScrollArea',
  ClayEmptyState: 'ZoruEmptyState',
  ClaySheet: 'ZoruSheet',
  ClayAccordion: 'ZoruAccordion',
};

let migratedCount = 0;
let skippedCount = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');

  // Skip if already on zoruui
  if (/from\s+['"]@\/components\/zoruui['"]/.test(original)) {
    skippedCount++;
    continue;
  }

  let s = original;

  // 1. react-icons/lu → lucide-react. Replace import block first.
  s = s.replace(
    /import\s*\{([^}]*)\}\s*from\s*['"]react-icons\/lu['"];?/g,
    (_, body) => {
      const names = body.split(',').map((n) => n.trim()).filter(Boolean);
      const renamed = names
        .map((n) => LU_RENAME[n] || n.replace(/^Lu/, ''))
        .filter((n, i, arr) => arr.indexOf(n) === i);
      return `import { ${renamed.join(', ')} } from 'lucide-react';`;
    },
  );
  // Replace usages of LuFoo throughout the body.
  for (const [from, to] of Object.entries(LU_RENAME)) {
    s = s.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }
  // Catch-all: any remaining `\bLu([A-Z]\w*)\b` → drop the Lu (best-effort).
  s = s.replace(/\bLu([A-Z]\w*)/g, '$1');

  // 2. @/components/clay → @/components/zoruui (rename module, replace tokens
  //    individually after).
  s = s.replace(/from\s+(['"])@\/components\/clay\1/g, "from '@/components/zoruui'");
  s = s.replace(/from\s+(['"])@\/components\/clay\/[\w-]+\1/g, "from '@/components/zoruui'");

  // 3. Clay component tokens → Zoru tokens. Just identifier swaps; fixing up
  //    the prop API differences (leading={}, padded={}, items=[]) is the
  //    job of a follow-up tsc pass — too brittle to regex here.
  for (const [from, to] of Object.entries(CLAY_TO_ZORU_COMPONENTS)) {
    s = s.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }

  // 4. shadcn primitives → Zoru. These use lowercase tag-style imports.
  const shadcnMap = {
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
  };
  s = s.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]@\/components\/ui\/(button|input|textarea|label|skeleton|switch|checkbox|avatar|separator|card|alert|badge)['"];?/g,
    (_, body) => {
      const names = body.split(',').map((n) => n.trim()).filter(Boolean);
      const mapped = names.map((n) => {
        const m = n.match(/^(\w+)(\s+as\s+\w+)?$/);
        if (!m) return n;
        const orig = m[1];
        const alias = m[2] || '';
        return (shadcnMap[orig] || orig) + alias;
      });
      return `import { ${mapped.join(', ')} } from '@/components/zoruui';`;
    },
  );
  // also map usage in JSX (since names changed in the import body, keep
  // them consistent in the markup).
  for (const [from, to] of Object.entries(shadcnMap)) {
    // Only swap when followed by `>` `/` ` ` or `\n` to avoid catching
    // arbitrary identifiers.
    s = s.replace(new RegExp(`\\b${from}(?=[\\s/>])`, 'g'), to);
  }

  // 5. useToast → useZoruToast
  s = s.replace(
    /import\s+\{[^}]*\buseToast\b[^}]*\}\s*from\s*['"]@\/hooks\/use-toast['"];?/g,
    `import { useZoruToast } from '@/components/zoruui';`,
  );
  s = s.replace(/\buseToast\b/g, 'useZoruToast');

  // 6. Class-token swaps (string-literal contexts only).
  const classSwaps = [
    [/\btext-foreground\b/g, 'text-zoru-ink'],
    [/\btext-muted-foreground\b/g, 'text-zoru-ink-muted'],
    [/\btext-destructive\b/g, 'text-zoru-danger-ink'],
    [/\bbg-card\b/g, 'bg-zoru-bg'],
    [/\bbg-muted\b/g, 'bg-zoru-surface-2'],
    [/\bbg-secondary\b/g, 'bg-zoru-surface-2'],
    [/\bbg-background\b/g, 'bg-zoru-bg'],
    [/\bbg-accent\b/g, 'bg-zoru-surface-2'],
    [/\btext-accent-foreground\b/g, 'text-zoru-ink'],
    [/\btext-secondary-foreground\b/g, 'text-zoru-ink'],
    [/\bborder-border\b/g, 'border-zoru-line'],
    [/\bborder-input\b/g, 'border-zoru-line'],
    [/\bring-ring\b/g, 'ring-zoru-ring'],
    [/\btext-emerald-(\d+)\b/g, 'text-zoru-success-ink'],
    [/\bbg-emerald-(\d+)(?:\/\d+)?\b/g, 'bg-zoru-success/10'],
    [/\btext-red-(\d+)\b/g, 'text-zoru-danger-ink'],
    [/\bbg-red-(\d+)(?:\/\d+)?\b/g, 'bg-zoru-danger/10'],
    [/\btext-amber-(\d+)\b/g, 'text-zoru-warning-ink'],
    [/\bbg-amber-(\d+)(?:\/\d+)?\b/g, 'bg-zoru-warning/15'],
    [/\bclay-enter\b/g, ''],
    [/\bfont-headline\b/g, ''],
    // Bold-by-default in zoru — remove redundant weight classes.
    [/\bfont-bold\b/g, ''],
    [/\bfont-semibold\b/g, ''],
    [/\bfont-medium\b/g, ''],
    [/\btracking-tight\b/g, ''],
    [/\btracking-\[-?[\d.]+em\]\b/g, ''],
  ];
  for (const [pattern, replacement] of classSwaps) {
    s = s.replace(pattern, replacement);
  }
  // Collapse whitespace inside class strings.
  s = s.replace(/className=(["'`])([^"'`]*?)\1/g, (_, q, body) => {
    const cleaned = body.replace(/\s+/g, ' ').trim();
    return `className=${q}${cleaned}${q}`;
  });

  // 7. ClayBadge tone="x" → variant="x". Map green→success, amber→warning,
  //    red→danger, neutral→ghost. Inline JSX only.
  s = s.replace(/tone="green"/g, 'variant="success"');
  s = s.replace(/tone="amber"/g, 'variant="warning"');
  s = s.replace(/tone="red"/g, 'variant="danger"');
  s = s.replace(/tone="neutral"/g, 'variant="ghost"');
  s = s.replace(/tone="rose"/g, 'variant="ghost"');
  s = s.replace(/tone="blue"/g, 'variant="info"');
  s = s.replace(/\sdot\b/g, ''); // ClayBadge had a `dot` prop

  // 8. ZoruButton variant rename — old code uses "obsidian"/"pill"/"rose".
  s = s.replace(/variant="obsidian"/g, '');
  s = s.replace(/variant="pill"/g, 'variant="outline"');
  s = s.replace(/variant="rose"/g, '');

  // 9. ClayButton API: leading/trailing → children. We can't safely transform
  //    these with regex, so we just strip the prop names and trust the icon
  //    lands inline through the children. This is a known gap — files that
  //    used `leading={}`/`trailing={}` will get tsc errors and need a hand
  //    fix.
  // (Skipped — too brittle. tsc will surface offenders.)

  // 10. ClayInput leading/trailing → leadingSlot/trailingSlot
  s = s.replace(/leading=\{/g, 'leadingSlot={');
  s = s.replace(/trailing=\{/g, 'trailingSlot={');

  // 11. ClayCard padded → strip; padded={false} → className="p-0"
  s = s.replace(/\spadded\s*=\s*\{false\}/g, ' className="p-0"');
  s = s.replace(/\spadded(?=\s|>|\/)/g, '');

  if (s !== original) {
    fs.writeFileSync(file, s, 'utf8');
    migratedCount++;
  }
}

console.log(`Codemod complete: migrated=${migratedCount} skipped=${skippedCount}/${files.length}`);
