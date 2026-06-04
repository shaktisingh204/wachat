'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Users,
  Briefcase,
  StickyNote,
  CheckCircle2,
  Settings,
  Search,
  LayoutDashboard,
  ListTodo,
  Keyboard,
  Clock,
  Star,
  Plus,
  Table2,
  Columns3,
  Moon,
  Sun,
  Database,
  UserCog,
  SlidersHorizontal,
  Palette,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import {
  listSabcrmFavoritesTw,
  listSabcrmObjectsTw,
  listSabcrmRecordsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type {
  ObjectMetadata,
  SabcrmRustRecord,
} from '@/app/actions/sabcrm-twenty.actions.types';
import { TwentyAvatar } from './twenty-primitives';
import type { TwentyAvatarShape } from './twenty-primitives';
import { useSabcrmSettings } from '@/components/sabcrm/twenty/sabcrm-settings-context';

import './twenty-command-menu.css';

/* =========================================================================
   Recently-viewed records — small localStorage helper

   We own this file, so we keep a self-contained list of the records the user
   most recently opened *through the menu*. It's read to render the "Recent"
   group when the query is empty, and pushed to whenever a record / recent /
   favorite row is selected. Capped + deduped, newest first.
   ========================================================================= */
const RECENTS_KEY = 'sabcrm:cmdk:recents';
const RECENTS_CAP = 8;

interface RecordRecent {
  /** URL object slug, e.g. "companies". */
  slug: string;
  /** Record id. */
  id: string;
  /** Display label captured at view time. */
  label: string;
  /** Avatar image URL captured at view time (optional). */
  avatarUrl?: string;
}

function readRecents(): RecordRecent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is RecordRecent =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as RecordRecent).slug === 'string' &&
          typeof (e as RecordRecent).id === 'string' &&
          typeof (e as RecordRecent).label === 'string',
      )
      .map((e) => ({
        slug: e.slug,
        id: e.id,
        label: e.label,
        avatarUrl:
          typeof e.avatarUrl === 'string' && e.avatarUrl.length > 0
            ? e.avatarUrl
            : undefined,
      }))
      .slice(0, RECENTS_CAP);
  } catch {
    return [];
  }
}

function pushRecent(entry: RecordRecent): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = readRecents().filter(
      (e) => !(e.slug === entry.slug && e.id === entry.id),
    );
    const next = [entry, ...existing].slice(0, RECENTS_CAP);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode / quota) — recents simply won't persist */
  }
}

/** The exported helper, in case the host ever wants to seed recents directly. */
export const recordRecents = {
  read: readRecents,
  push: pushRecent,
};

/* =========================================================================
   Theme toggle — bridges to the SabCRM prefs store (`useCrmPrefs`)

   Twenty surfaces a "Toggle dark/light theme" command. SabCRM persists its
   theme in the `sabcrm.prefs.v1` localStorage blob and reflects it by toggling
   `st-theme-dark` on the `.sabcrm-twenty` frame root (see
   `app/dashboard/settings/crm/use-crm-prefs.ts`). We write the SAME shape here and
   apply the class immediately, so the toggle takes effect without a reload and
   Settings → Appearance picks it up on next mount. Anything that depends on a
   backend stays untouched — this is purely the device-local preference.
   ========================================================================= */
const PREFS_KEY = 'sabcrm.prefs.v1';
type StoredTheme = 'light' | 'dark' | 'system';

function readStoredTheme(): StoredTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return 'light';
    const parsed = JSON.parse(raw) as { theme?: unknown };
    const t = parsed?.theme;
    if (t === 'dark' || t === 'light' || t === 'system') return t;
    return 'light';
  } catch {
    return 'light';
  }
}

/** True if the SabCRM frame is currently rendering its dark palette. */
function isDarkActive(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.querySelector('.sabcrm-twenty');
  if (root?.classList.contains('st-theme-dark')) return true;
  const stored = readStoredTheme();
  if (stored === 'dark') return true;
  if (
    stored === 'system' &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

/** Flip light↔dark, persisting to the shared prefs blob + applying the class. */
function toggleTheme(): void {
  if (typeof window === 'undefined') return;
  const nextDark = !isDarkActive();
  // Merge into the existing prefs blob so we don't clobber the other prefs.
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...prev, theme: nextDark ? 'dark' : 'light' }),
    );
  } catch {
    /* quota / private mode — class still applies for this session below */
  }
  const root = document.querySelector('.sabcrm-twenty');
  root?.classList.toggle('st-theme-dark', nextDark);
}

/* =========================================================================
   Object catalogue — icons + label fallbacks

   Standard objects map to dedicated icons. Custom objects (loaded from
   `listSabcrmObjectsTw`) fall back to a generic Database glyph. The static
   STANDARD_OBJECTS list is the graceful fallback when the catalogue can't load.
   ========================================================================= */
const STANDARD_OBJECT_ICON: Record<string, LucideIcon> = {
  companies: Building2,
  people: Users,
  leads: Briefcase,
  notes: StickyNote,
  tasks: CheckCircle2,
};

/**
 * Avatar shape per standard object. People render as circles (Twenty's
 * person-avatar treatment); companies + everything else default to the
 * 4px-rounded square logo treatment. Custom objects inherit the square.
 */
const STANDARD_OBJECT_AVATAR_SHAPE: Record<string, TwentyAvatarShape> = {
  people: 'round',
  companies: 'square',
  leads: 'square',
  notes: 'square',
  tasks: 'square',
};

function avatarShapeForSlug(slug: string): TwentyAvatarShape {
  return STANDARD_OBJECT_AVATAR_SHAPE[slug] ?? 'square';
}

/** Human-readable singular label for a slug (used in record-row meta). */
const STANDARD_OBJECT_LABEL: Record<string, string> = {
  companies: 'Company',
  people: 'Person',
  leads: 'Lead',
  notes: 'Note',
  tasks: 'Task',
};

/** Fallback object catalogue when the metadata layer is unavailable. */
const FALLBACK_OBJECTS: readonly ObjectCatalogueEntry[] = [
  { slug: 'companies', labelSingular: 'Company', labelPlural: 'Companies', hasBoard: false },
  { slug: 'people', labelSingular: 'Person', labelPlural: 'People', hasBoard: false },
  { slug: 'leads', labelSingular: 'Lead', labelPlural: 'Leads', hasBoard: true },
  { slug: 'notes', labelSingular: 'Note', labelPlural: 'Notes', hasBoard: false },
  { slug: 'tasks', labelSingular: 'Task', labelPlural: 'Tasks', hasBoard: false },
] as const;

/** The slice of object metadata the menu needs. */
interface ObjectCatalogueEntry {
  slug: string;
  labelSingular: string;
  labelPlural: string;
  /** Whether the object supports the Kanban board view. */
  hasBoard: boolean;
  /** Field key whose value labels a record, when known from metadata. */
  labelFieldKey?: string;
}

function iconForSlug(slug: string): LucideIcon {
  return STANDARD_OBJECT_ICON[slug] ?? Database;
}

function singularLabelForSlug(
  slug: string,
  catalogue: readonly ObjectCatalogueEntry[],
): string {
  const hit = catalogue.find((o) => o.slug === slug);
  if (hit) return hit.labelSingular;
  return STANDARD_OBJECT_LABEL[slug] ?? slug;
}

/* =========================================================================
   Record-label derivation (client-side)

   `listSabcrmRecordsTw` returns raw `{ id, object, data }` rows — `data` is a
   free-form map. We derive a display label the way the engine does: the
   object's designated label field first, then a cascade of common name-ish
   keys, finally the id tail. Keeps the "jump to a record" rows readable for
   standard AND custom objects without a server round-trip per row.
   ========================================================================= */
const LABEL_FIELD_FALLBACKS = [
  'name',
  'title',
  'subject',
  'displayName',
  'fullName',
  'companyName',
  'email',
  'label',
] as const;

function deriveRecordLabel(
  record: SabcrmRustRecord,
  labelFieldKey?: string,
): string {
  const data = record.data ?? {};
  const pick = (key: string): string | undefined => {
    const v = data[key];
    return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
  };

  if (labelFieldKey) {
    const fromMeta = pick(labelFieldKey);
    if (fromMeta) return fromMeta;
  }

  // firstName + lastName composite (people).
  const first = pick('firstName');
  const last = pick('lastName');
  if (first || last) return [first, last].filter(Boolean).join(' ');

  for (const key of LABEL_FIELD_FALLBACKS) {
    const v = pick(key);
    if (v) return v;
  }

  return `Untitled · ${record.id.slice(-6)}`;
}

/**
 * Best-effort avatar image URL for a record. Mirrors Twenty's record-chip
 * avatar resolution: people use a photo field, companies a logo/domain-derived
 * mark, and any object may carry an explicit avatar/image field. Returns
 * `undefined` when none is present, so the avatar falls back to initials.
 */
const AVATAR_FIELD_FALLBACKS = [
  'avatarUrl',
  'avatar',
  'photoUrl',
  'photo',
  'logoUrl',
  'logo',
  'imageUrl',
  'image',
  'picture',
] as const;

function deriveRecordAvatarUrl(record: SabcrmRustRecord): string | undefined {
  const data = record.data ?? {};
  for (const key of AVATAR_FIELD_FALLBACKS) {
    const v = data[key];
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) {
      return v.trim();
    }
  }
  return undefined;
}

/**
 * Best-effort label for a favorite, which carries only `{ object, recordId }`
 * (no record name). Mirrors the sidebar's favorite labelling.
 */
function favoriteLabel(
  object: string,
  recordId: string,
  catalogue: readonly ObjectCatalogueEntry[],
): string {
  const objLabel = singularLabelForSlug(object, catalogue);
  return `${objLabel} · ${recordId.slice(-6)}`;
}

/* =========================================================================
   Static "global" navigation + actions (catalogue-independent)
   ========================================================================= */
interface NavCommand {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  keywords?: string;
}

/** Navigation that isn't an object index — settings, dashboard, etc. */
const GLOBAL_NAV_COMMANDS: readonly NavCommand[] = [
  {
    id: 'nav-dashboard',
    label: 'Go to Dashboard',
    href: '/sabcrm/dashboard',
    icon: LayoutDashboard,
    keywords: 'home overview',
  },
  {
    id: 'nav-my-work',
    label: 'Go to My Work',
    href: '/sabcrm/my-work',
    icon: ListTodo,
    keywords: 'assigned tasks mine',
  },
  {
    id: 'nav-search',
    label: 'Go to Search',
    href: '/sabcrm/search',
    icon: Search,
    keywords: 'find records',
  },
] as const;

/** Settings destinations (Twenty groups these under "Go to settings"). */
const SETTINGS_COMMANDS: readonly NavCommand[] = [
  {
    id: 'set-root',
    label: 'Go to Settings',
    href: '/dashboard/settings/crm',
    icon: Settings,
    keywords: 'settings preferences configuration',
  },
  {
    id: 'set-appearance',
    label: 'Settings · Appearance',
    href: '/dashboard/settings/crm/appearance',
    icon: Palette,
    keywords: 'theme dark light density appearance',
  },
  {
    id: 'set-profile',
    label: 'Settings · Profile',
    href: '/dashboard/settings/crm/profile',
    icon: UserCog,
    keywords: 'profile account name email',
  },
  {
    id: 'set-general',
    label: 'Settings · General',
    href: '/dashboard/settings/crm/general',
    icon: SlidersHorizontal,
    keywords: 'general workspace',
  },
] as const;

/* =========================================================================
   Keyboard-shortcuts help reference
   ========================================================================= */
interface ShortcutEntry {
  keys: readonly string[];
  label: string;
}

const SHORTCUTS: readonly ShortcutEntry[] = [
  { keys: ['⌘', 'K'], label: 'Open command menu' },
  { keys: ['/'], label: 'Open & search' },
  { keys: ['↑', '↓'], label: 'Navigate items' },
  { keys: ['↵'], label: 'Select item' },
  { keys: ['Esc'], label: 'Close' },
  { keys: ['?'], label: 'Toggle this help' },
] as const;

/* =========================================================================
   Flattened item model (for keyboard navigation)
   ========================================================================= */
/**
 * Avatar descriptor for record-style rows (records / recents / favorites).
 * When present, the row renders a {@link TwentyAvatar} instead of the Lucide
 * `icon` — faithful to Twenty, where record results carry their own avatar.
 */
interface CmdItemAvatar {
  name: string;
  src?: string;
  shape: TwentyAvatarShape;
}

interface CmdItem {
  /** Unique key across the whole menu. */
  key: string;
  label: string;
  meta?: string;
  icon: LucideIcon;
  /** Record avatar; when set, replaces `icon` in the row. */
  avatar?: CmdItemAvatar;
  /** Invoked on Enter / click. */
  onSelect: () => void;
}

interface RecordResult {
  slug: string;
  id: string;
  label: string;
  avatarUrl?: string;
}

/** A favorite as surfaced in the menu (object slug + record id). */
interface FavoriteEntry {
  object: string;
  recordId: string;
}

const SEARCH_DEBOUNCE_MS = 200;
const PER_OBJECT_LIMIT = 5;
/** How many objects we fan record-search across (keeps the menu snappy). */
const MAX_SEARCH_OBJECTS = 6;

export interface TwentyCommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active SabCRM project id, forwarded to the record-search action. */
  projectId?: string;
  /**
   * Whether the keyboard-shortcuts help overlay is visible. Optional: when the
   * host does not control it, the component self-manages help state and listens
   * for the `?` shortcut itself.
   */
  helpOpen?: boolean;
  /** Toggle the keyboard-shortcuts help overlay. */
  onHelpOpenChange?: (open: boolean) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

function matchesTerm(term: string, ...haystacks: (string | undefined)[]): boolean {
  if (!term) return true;
  return haystacks.some((h) => h?.toLowerCase().includes(term));
}

export function TwentyCommandMenu({
  open,
  onOpenChange,
  projectId,
  helpOpen: helpOpenProp,
  onHelpOpenChange,
}: TwentyCommandMenuProps): React.JSX.Element | null {
  const router = useRouter();
  const { lab } = useSabcrmSettings();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Uncontrolled fallback for the help overlay when the host doesn't drive it.
  const isHelpControlled = helpOpenProp !== undefined;
  const [helpOpenLocal, setHelpOpenLocal] = React.useState(false);
  const helpOpen = isHelpControlled ? helpOpenProp : helpOpenLocal;
  const setHelpOpen = React.useCallback(
    (next: boolean) => {
      if (isHelpControlled) onHelpOpenChange?.(next);
      else setHelpOpenLocal(next);
    },
    [isHelpControlled, onHelpOpenChange],
  );

  const [query, setQuery] = React.useState('');
  const [records, setRecords] = React.useState<RecordResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  // Live object catalogue (drives Create / Navigate / View / record search).
  const [catalogue, setCatalogue] =
    React.useState<readonly ObjectCatalogueEntry[]>(FALLBACK_OBJECTS);

  // Empty-query sections.
  const [recents, setRecents] = React.useState<RecordRecent[]>([]);
  const [favorites, setFavorites] = React.useState<FavoriteEntry[]>([]);

  // Theme label flips so the row reads "Dark theme" / "Light theme" correctly.
  const [darkActive, setDarkActive] = React.useState(false);

  // Reset transient state every time the menu opens; refresh recents/favorites.
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setRecords([]);
      setError(null);
      setLoading(false);
      setActiveIndex(0);
      setRecents(readRecents());
      setDarkActive(isDarkActive());
      // Autofocus once the panel has mounted.
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  // Load the object catalogue whenever the menu opens. Degrades to the static
  // FALLBACK_OBJECTS if metadata is unavailable, so Create/View never vanish.
  React.useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    void (async () => {
      const res = await listSabcrmObjectsTw(projectId);
      if (cancelled) return;
      if (res.ok && res.data.length > 0) {
        setCatalogue(
          res.data.map((o: ObjectMetadata) => ({
            slug: o.slug,
            labelSingular: o.labelSingular,
            labelPlural: o.labelPlural,
            hasBoard: o.views?.includes('board') ?? false,
            labelFieldKey: o.fields?.find((f) => f.isLabel)?.key,
          })),
        );
      } else {
        setCatalogue(FALLBACK_OBJECTS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  // Load favorites whenever the menu opens (non-blocking, graceful on failure).
  React.useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    void (async () => {
      const res = await listSabcrmFavoritesTw(projectId);
      if (cancelled) return;
      setFavorites(
        res.ok
          ? res.data.map((f) => ({ object: f.object, recordId: f.recordId }))
          : [],
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  // Debounced "jump to a record" search, fanned out across the catalogue via
  // `listSabcrmRecordsTw` (gated server action). Labels are derived client-side
  // from each row's `data` + the object's label field.
  React.useEffect(() => {
    if (!open) return undefined;

    const term = query.trim();
    if (term.length === 0) {
      setRecords([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const searchObjects = catalogue.slice(0, MAX_SEARCH_OBJECTS);

    let cancelled = false;
    setLoading(true);
    setError(null);

    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const settled = await Promise.all(
            searchObjects.map(async (obj) => {
              const res = await listSabcrmRecordsTw(
                obj.slug,
                { q: term, limit: PER_OBJECT_LIMIT },
                projectId,
              );
              if (!res.ok) return { obj, rows: [] as SabcrmRustRecord[] };
              return { obj, rows: res.data.records };
            }),
          );
          if (cancelled) return;

          const flat: RecordResult[] = settled.flatMap(({ obj, rows }) =>
            rows.map((row) => ({
              slug: obj.slug,
              id: row.id,
              label: deriveRecordLabel(row, obj.labelFieldKey),
              avatarUrl: deriveRecordAvatarUrl(row),
            })),
          );
          setRecords(flat);
          setActiveIndex(0);
        } catch {
          if (!cancelled) {
            setError('Search is unavailable right now.');
            setRecords([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query, projectId, catalogue]);

  const navigate = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  /**
   * Open a record: record it in the recents list (capped + deduped), then
   * navigate. Used by record search results, recents, and favorites alike.
   */
  const openRecord = React.useCallback(
    (slug: string, id: string, label: string, avatarUrl?: string) => {
      pushRecent({ slug, id, label, avatarUrl });
      setRecents(readRecents());
      navigate(`/sabcrm/${slug}/${id}`);
    },
    [navigate],
  );

  const openHelp = React.useCallback(() => {
    onOpenChange(false);
    setHelpOpen(true);
  }, [onOpenChange, setHelpOpen]);

  const runToggleTheme = React.useCallback(() => {
    toggleTheme();
    setDarkActive(isDarkActive());
    onOpenChange(false);
  }, [onOpenChange]);

  // When the help overlay is uncontrolled, listen for the `?` shortcut here so
  // it works even if the host never wires `helpOpen`/`onHelpOpenChange`.
  React.useEffect(() => {
    if (isHelpControlled) return undefined;
    function onDocKeyDown(event: KeyboardEvent): void {
      if (
        event.key === '?' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        onOpenChange(false);
        setHelpOpenLocal((prev) => !prev);
      }
    }
    document.addEventListener('keydown', onDocKeyDown);
    return () => document.removeEventListener('keydown', onDocKeyDown);
  }, [isHelpControlled, onOpenChange]);

  const term = query.trim().toLowerCase();

  // ----- "Navigate" group: each object index + global destinations ----------
  const navItems = React.useMemo<CmdItem[]>(() => {
    const objectNav: CmdItem[] = catalogue
      .filter((o) => matchesTerm(term, o.labelPlural, o.slug))
      .map((o) => ({
        key: `nav-obj-${o.slug}`,
        label: `Go to ${o.labelPlural}`,
        meta: 'Navigate',
        icon: iconForSlug(o.slug),
        onSelect: () => navigate(`/sabcrm/${o.slug}`),
      }));

    const globalNav: CmdItem[] = GLOBAL_NAV_COMMANDS.filter((c) =>
      matchesTerm(term, c.label, c.keywords),
    ).map((c) => ({
      key: c.id,
      label: c.label,
      meta: 'Navigate',
      icon: c.icon,
      onSelect: () => navigate(c.href),
    }));

    return [...objectNav, ...globalNav];
  }, [catalogue, term, navigate]);

  // ----- "Create" group: one create action per object -----------------------
  const createItems = React.useMemo<CmdItem[]>(
    () =>
      catalogue
        .filter((o) =>
          matchesTerm(term, `create ${o.labelSingular}`, `new add ${o.labelSingular}`, o.slug),
        )
        .map((o) => ({
          key: `create-${o.slug}`,
          label: `Create ${o.labelSingular}`,
          meta: 'Create',
          icon: Plus,
          // The index page surfaces its create flow on `?new=1`; it renders
          // fine without the hint, so this degrades gracefully.
          onSelect: () => navigate(`/sabcrm/${o.slug}?new=1`),
        })),
    [catalogue, term, navigate],
  );

  // ----- "View" group: switch each object to Table / Board ------------------
  const viewItems = React.useMemo<CmdItem[]>(() => {
    const items: CmdItem[] = [];
    for (const o of catalogue) {
      if (matchesTerm(term, `${o.labelPlural} table`, `${o.slug} table view`)) {
        items.push({
          key: `view-table-${o.slug}`,
          label: `${o.labelPlural} · Table view`,
          meta: 'View',
          icon: Table2,
          onSelect: () => navigate(`/sabcrm/${o.slug}?view=table`),
        });
      }
      if (
        o.hasBoard &&
        matchesTerm(term, `${o.labelPlural} board`, `${o.slug} board kanban view`)
      ) {
        items.push({
          key: `view-board-${o.slug}`,
          label: `${o.labelPlural} · Board view`,
          meta: 'View',
          icon: Columns3,
          onSelect: () => navigate(`/sabcrm/${o.slug}?view=board`),
        });
      }
    }
    return items;
  }, [catalogue, term, navigate]);

  // ----- "Settings" group ---------------------------------------------------
  const settingsItems = React.useMemo<CmdItem[]>(
    () =>
      SETTINGS_COMMANDS.filter((c) =>
        matchesTerm(term, c.label, c.keywords),
      ).map((c) => ({
        key: c.id,
        label: c.label,
        meta: 'Settings',
        icon: c.icon,
        onSelect: () => navigate(c.href),
      })),
    [term, navigate],
  );

  // ----- "Preferences" group: theme toggle ----------------------------------
  const preferenceItems = React.useMemo<CmdItem[]>(() => {
    const label = darkActive ? 'Switch to light theme' : 'Switch to dark theme';
    if (!matchesTerm(term, label, 'toggle theme dark light appearance mode')) {
      return [];
    }
    return [
      {
        key: 'pref-toggle-theme',
        label,
        meta: 'Preference',
        icon: darkActive ? Sun : Moon,
        onSelect: runToggleTheme,
      },
    ];
  }, [darkActive, term, runToggleTheme]);

  // ----- "Actions" group: record-level actions (Lab: commandMenuActions) ----
  // Only shown when the `commandMenuActions` Lab flag is on. With the flag off
  // (the default) nothing changes — no regression. With it on, a new "Actions"
  // group appears that lets the user navigate to inline-create or object-level
  // action pages for each object. This is the _experimental_ wire; a richer
  // implementation (delete, archive, etc.) can follow once stabilised.
  const actionItems = React.useMemo<CmdItem[]>(() => {
    if (!lab.commandMenuActions) return [];
    return catalogue
      .filter((o) =>
        matchesTerm(term, `${o.labelSingular} actions`, `manage ${o.labelSingular}`, o.slug),
      )
      .map((o) => ({
        key: `action-${o.slug}`,
        label: `${o.labelSingular} actions`,
        meta: 'Actions',
        icon: Zap,
        onSelect: () => navigate(`/sabcrm/${o.slug}?actions=1`),
      }));
  }, [lab.commandMenuActions, catalogue, term, navigate]);

  // ----- "Records" group: jump to a record ----------------------------------
  const recordItems = React.useMemo<CmdItem[]>(
    () =>
      records.map((r) => {
        const label = r.label || 'Untitled';
        return {
          key: `rec-${r.slug}-${r.id}`,
          label,
          meta: singularLabelForSlug(r.slug, catalogue),
          icon: iconForSlug(r.slug),
          avatar: {
            name: label,
            src: r.avatarUrl,
            shape: avatarShapeForSlug(r.slug),
          },
          onSelect: () => openRecord(r.slug, r.id, label, r.avatarUrl),
        };
      }),
    [records, catalogue, openRecord],
  );

  // Empty-query "Recent" group (from localStorage).
  const recentItems = React.useMemo<CmdItem[]>(
    () =>
      recents.map((r) => {
        const label = r.label || 'Untitled';
        return {
          key: `recent-${r.slug}-${r.id}`,
          label,
          meta: singularLabelForSlug(r.slug, catalogue),
          icon: STANDARD_OBJECT_ICON[r.slug] ?? Clock,
          avatar: {
            name: label,
            src: r.avatarUrl,
            shape: avatarShapeForSlug(r.slug),
          },
          onSelect: () => openRecord(r.slug, r.id, label, r.avatarUrl),
        };
      }),
    [recents, catalogue, openRecord],
  );

  // Empty-query "Favorites" group (from the Rust engine).
  const favoriteItems = React.useMemo<CmdItem[]>(
    () =>
      favorites.map((f) => {
        const label = favoriteLabel(f.object, f.recordId, catalogue);
        return {
          key: `fav-${f.object}-${f.recordId}`,
          label,
          meta: singularLabelForSlug(f.object, catalogue),
          icon: STANDARD_OBJECT_ICON[f.object] ?? Star,
          avatar: {
            name: label,
            shape: avatarShapeForSlug(f.object),
          },
          onSelect: () => openRecord(f.object, f.recordId, label),
        };
      }),
    [favorites, catalogue, openRecord],
  );

  // Recent/Favorites only show when the query is empty.
  const showSuggestions = term.length === 0;
  const visibleRecentItems = showSuggestions ? recentItems : [];
  const visibleFavoriteItems = showSuggestions ? favoriteItems : [];

  // Flattened, ordered list used for keyboard navigation. Mirrors render order.
  const flatItems = React.useMemo<CmdItem[]>(
    () => [
      ...visibleRecentItems,
      ...visibleFavoriteItems,
      ...createItems,
      ...navItems,
      ...viewItems,
      ...settingsItems,
      ...preferenceItems,
      ...actionItems,
      ...recordItems,
    ],
    [
      visibleRecentItems,
      visibleFavoriteItems,
      createItems,
      navItems,
      viewItems,
      settingsItems,
      preferenceItems,
      actionItems,
      recordItems,
    ],
  );

  // Keep the active index within bounds when the result set changes.
  React.useEffect(() => {
    setActiveIndex((prev) => {
      if (flatItems.length === 0) return 0;
      return Math.min(prev, flatItems.length - 1);
    });
  }, [flatItems.length]);

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onOpenChange(false);
          break;
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndex((prev) =>
            flatItems.length === 0 ? 0 : (prev + 1) % flatItems.length,
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setActiveIndex((prev) =>
            flatItems.length === 0
              ? 0
              : (prev - 1 + flatItems.length) % flatItems.length,
          );
          break;
        case 'Enter': {
          event.preventDefault();
          const item = flatItems[activeIndex];
          if (item) item.onSelect();
          break;
        }
        case 'Tab': {
          // Focus trap: keep Tab/Shift+Tab inside the dialog.
          const panel = panelRef.current;
          if (!panel) break;
          const focusables = panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
          if (focusables.length === 0) {
            event.preventDefault();
            break;
          }
          const first = focusables[0]!;
          const last = focusables[focusables.length - 1]!;
          const activeEl = document.activeElement;
          if (event.shiftKey && activeEl === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && activeEl === last) {
            event.preventDefault();
            first.focus();
          }
          break;
        }
        default:
          break;
      }
    },
    [flatItems, activeIndex, onOpenChange],
  );

  // ----- Keyboard-shortcuts help overlay (standalone, can show on its own) ---
  const helpOverlay = helpOpen ? (
    <div
      className="st-cmdk-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setHelpOpen(false);
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="st-cmdk-panel st-cmdk-panel--help"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setHelpOpen(false);
          }
        }}
        tabIndex={-1}
        ref={(node) => {
          // Focus the panel so Escape works without an input inside.
          if (node) node.focus();
        }}
      >
        <div className="st-cmdk-help__header">
          <Keyboard size={18} aria-hidden="true" />
          <span className="st-cmdk-help__title">Keyboard shortcuts</span>
          <kbd className="st-cmdk-search__esc">Esc</kbd>
        </div>
        <div className="st-cmdk-help__list">
          {SHORTCUTS.map((s) => (
            <div className="st-cmdk-help__row" key={s.label}>
              <span className="st-cmdk-help__label">{s.label}</span>
              <span className="st-cmdk-help__keys">
                {s.keys.map((k, i) => (
                  <kbd className="st-cmdk-kbd" key={`${s.label}-${i}`}>
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : null;

  if (!open) return helpOverlay;

  const showEmpty = term.length > 0 && !loading && !error && flatItems.length === 0;

  let flatCursor = 0;
  const renderRow = (item: CmdItem): React.JSX.Element => {
    const index = flatCursor;
    flatCursor += 1;
    const Icon = item.icon;
    const isActive = index === activeIndex;
    return (
      <button
        key={item.key}
        id={`st-cmdk-opt-${index}`}
        type="button"
        role="option"
        aria-selected={isActive}
        className={`st-cmdk-row${isActive ? ' is-active' : ''}`}
        onMouseMove={() => setActiveIndex(index)}
        onClick={() => item.onSelect()}
      >
        {item.avatar ? (
          <span className="st-cmdk-row__avatar">
            <TwentyAvatar
              name={item.avatar.name}
              src={item.avatar.src}
              shape={item.avatar.shape}
              size="sm"
            />
          </span>
        ) : (
          <span className="st-cmdk-row__icon">
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
        <span className="st-cmdk-row__label">{item.label}</span>
        {item.meta ? <span className="st-cmdk-row__meta">{item.meta}</span> : null}
      </button>
    );
  };

  const renderGroup = (
    title: string,
    items: CmdItem[],
    modifier?: string,
  ): React.JSX.Element | null => {
    if (items.length === 0) return null;
    return (
      <div className={`st-cmdk-group${modifier ? ` ${modifier}` : ''}`}>
        <div className="st-cmdk-group__title">{title}</div>
        {items.map(renderRow)}
      </div>
    );
  };

  return (
    <>
      <div
        className="st-cmdk-overlay"
        role="presentation"
        onMouseDown={(e) => {
          // Backdrop click (not a click that bubbled from the panel) closes.
          if (e.target === e.currentTarget) onOpenChange(false);
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          ref={panelRef}
          className="st-cmdk-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Command menu"
          onKeyDown={onKeyDown}
        >
          <div className="st-cmdk-search">
            <Search className="st-cmdk-search__icon" size={18} aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              className="st-cmdk-search__input"
              placeholder="Search commands and records…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              role="combobox"
              aria-expanded
              aria-controls="st-cmdk-listbox"
              aria-activedescendant={
                flatItems.length > 0 ? `st-cmdk-opt-${activeIndex}` : undefined
              }
              aria-label="Search commands and records"
            />
            <kbd className="st-cmdk-search__esc">Esc</kbd>
          </div>

          <div
            className="st-cmdk-body"
            id="st-cmdk-listbox"
            role="listbox"
            aria-label="Results"
          >
            {renderGroup('Recent', visibleRecentItems, 'st-cmdk-group--recent')}
            {renderGroup(
              'Favorites',
              visibleFavoriteItems,
              'st-cmdk-group--favorites',
            )}
            {renderGroup('Create', createItems)}
            {renderGroup('Navigate', navItems)}
            {renderGroup('View', viewItems)}
            {renderGroup('Settings', settingsItems)}
            {renderGroup('Preferences', preferenceItems)}
            {renderGroup('Actions', actionItems)}
            {renderGroup('Records', recordItems)}

            {loading ? (
              <div className="st-cmdk-status" role="status">
                Searching…
              </div>
            ) : null}

            {error ? (
              <div className="st-cmdk-status st-cmdk-status--error" role="status">
                {error}
              </div>
            ) : null}

            {showEmpty ? (
              <div className="st-cmdk-status" role="status">
                No results for “{query.trim()}”.
              </div>
            ) : null}
          </div>

          <div className="st-cmdk-footer">
            <span className="st-cmdk-footer__hint">
              <kbd className="st-cmdk-kbd">↑</kbd>
              <kbd className="st-cmdk-kbd">↓</kbd>
              <span>navigate</span>
            </span>
            <span className="st-cmdk-footer__hint">
              <kbd className="st-cmdk-kbd">↵</kbd>
              <span>select</span>
            </span>
            <button
              type="button"
              className="st-cmdk-footer__help"
              onClick={openHelp}
            >
              <kbd className="st-cmdk-kbd">?</kbd>
              <span>shortcuts</span>
            </button>
          </div>
        </div>
      </div>
      {helpOverlay}
    </>
  );
}

export default TwentyCommandMenu;
