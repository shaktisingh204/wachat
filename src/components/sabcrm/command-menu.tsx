'use client';

/**
 * CommandMenu — the SabCRM global ⌘K palette on the 20ui `CommandDialog`.
 *
 * Replaces `twenty/twenty-command-menu.tsx`. The data layer (recents, theme
 * toggle, object catalogue, favorites, the debounced record search, label /
 * avatar derivation, the static nav tables) moved VERBATIM to
 * `./command-menu-data.ts`; this file is presentation only.
 *
 * Shell: 20ui `Command*` primitives (cmdk) with `shouldFilter={false}` —
 * results are pre-filtered host-side via `matchesTerm` / the gated record
 * search, so cmdk must NOT re-filter. cmdk owns roving focus, ArrowUp/Down,
 * Enter, `loop`, and Escape (wired inside `CommandDialog`). Group render
 * order is unchanged from the Twenty menu: Recent, Favorites, Create,
 * Navigate, View, Settings, Preferences, Actions, Records.
 *
 * The keyboard-shortcuts help overlay (`?`) renders as a small 20ui `Modal`.
 * Props contract is identical to the old `TwentyCommandMenu`.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  Columns3,
  Moon,
  Plus,
  Star,
  Sun,
  Table2,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/sabcrm/20ui/command';
import { Avatar, type AvatarShape } from '@/components/sabcrm/20ui/avatar';
import { Modal } from '@/components/sabcrm/20ui/modal';
import { Kbd } from '@/components/sabcrm/20ui/misc';
import { useSabcrmSettings } from '@/components/sabcrm/sabcrm-settings-context';

import {
  GLOBAL_NAV_COMMANDS,
  SETTINGS_COMMANDS,
  SHORTCUTS,
  STANDARD_OBJECT_ICON,
  avatarShapeForSlug,
  favoriteLabel,
  iconForSlug,
  isDarkActive,
  isEditableTarget,
  matchesTerm,
  pushRecent,
  readRecents,
  singularLabelForSlug,
  toggleTheme,
  useCommandFavorites,
  useObjectCatalogue,
  useRecordSearch,
  type RecordRecent,
} from './command-menu-data';

import './command-menu.css';

/**
 * Avatar descriptor for record-style rows (records / recents / favorites).
 * When present, the row renders a 20ui `Avatar` instead of the Lucide
 * `icon` — faithful to Twenty, where record results carry their own avatar.
 */
interface CmdItemAvatar {
  name: string;
  src?: string;
  shape: AvatarShape;
}

interface CmdItem {
  /** Unique key across the whole menu (doubles as the cmdk item value). */
  key: string;
  label: string;
  meta?: string;
  icon: LucideIcon;
  /** Record avatar; when set, replaces `icon` in the row. */
  avatar?: CmdItemAvatar;
  /** Invoked on Enter / click. */
  onSelect: () => void;
}

export interface CommandMenuProps {
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

export function CommandMenu({
  open,
  onOpenChange,
  projectId,
  helpOpen: helpOpenProp,
  onHelpOpenChange,
}: CommandMenuProps): React.JSX.Element {
  const router = useRouter();
  const { lab } = useSabcrmSettings();

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

  // Empty-query "Recent" group (from localStorage).
  const [recents, setRecents] = React.useState<RecordRecent[]>([]);

  // Theme label flips so the row reads "Dark theme" / "Light theme" correctly.
  const [darkActive, setDarkActive] = React.useState(false);

  // Data layer (catalogue / favorites / debounced record search).
  const catalogue = useObjectCatalogue(open, projectId);
  const favorites = useCommandFavorites(open, projectId);
  const { records, loading, error } = useRecordSearch(open, query, catalogue, projectId);

  // Reset transient state every time the menu opens; refresh recents.
  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setRecents(readRecents());
    setDarkActive(isDarkActive());
  }, [open]);

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

  // Same group order as the Twenty menu rendered (regression-snapshot parity).
  const groups: Array<{ key: string; heading: string; items: CmdItem[] }> = [
    { key: 'recent', heading: 'Recent', items: visibleRecentItems },
    { key: 'favorites', heading: 'Favorites', items: visibleFavoriteItems },
    { key: 'create', heading: 'Create', items: createItems },
    { key: 'navigate', heading: 'Navigate', items: navItems },
    { key: 'view', heading: 'View', items: viewItems },
    { key: 'settings', heading: 'Settings', items: settingsItems },
    { key: 'preferences', heading: 'Preferences', items: preferenceItems },
    { key: 'actions', heading: 'Actions', items: actionItems },
    { key: 'records', heading: 'Records', items: recordItems },
  ].filter((g) => g.items.length > 0);

  const showEmpty = term.length > 0 && !loading && !error;

  const renderRow = (item: CmdItem): React.JSX.Element => {
    const Icon = item.icon;
    return (
      <CommandItem
        key={item.key}
        value={item.key}
        onSelect={() => item.onSelect()}
      >
        {item.avatar ? (
          <span className="crm-cmd__avatar">
            <Avatar
              name={item.avatar.name}
              src={item.avatar.src}
              shape={item.avatar.shape}
              size="sm"
            />
          </span>
        ) : (
          <Icon size={16} aria-hidden="true" />
        )}
        <span className="crm-cmd__label">{item.label}</span>
        {item.meta ? <span className="crm-cmd__meta">{item.meta}</span> : null}
      </CommandItem>
    );
  };

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={onOpenChange}
        label="Command menu"
        shouldFilter={false}
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search commands and records…"
          aria-label="Search commands and records"
          spellCheck={false}
          autoComplete="off"
        />
        <CommandList>
          {showEmpty ? (
            <CommandEmpty>No results for “{query.trim()}”.</CommandEmpty>
          ) : null}

          {groups.map((group, index) => (
            <React.Fragment key={group.key}>
              {index > 0 ? <CommandSeparator /> : null}
              <CommandGroup heading={group.heading}>
                {group.items.map(renderRow)}
              </CommandGroup>
            </React.Fragment>
          ))}

          {loading ? (
            <div className="crm-cmd__status" role="status">
              Searching…
            </div>
          ) : null}

          {error ? (
            <div className="crm-cmd__status crm-cmd__status--error" role="status">
              {error}
            </div>
          ) : null}
        </CommandList>

        <div className="crm-cmd__footer">
          <span className="crm-cmd__footer-hint">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            <span>navigate</span>
          </span>
          <span className="crm-cmd__footer-hint">
            <Kbd>↵</Kbd>
            <span>select</span>
          </span>
          <button type="button" className="crm-cmd__footer-help" onClick={openHelp}>
            <Kbd>?</Kbd>
            <span>shortcuts</span>
          </button>
        </div>
      </CommandDialog>

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Keyboard shortcuts"
        size="sm"
      >
        <div className="crm-cmd-help">
          {SHORTCUTS.map((s) => (
            <div className="crm-cmd-help__row" key={s.label}>
              <span className="crm-cmd-help__label">{s.label}</span>
              <span className="crm-cmd-help__keys">
                {s.keys.map((k, i) => (
                  <Kbd key={`${s.label}-${i}`}>{k}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

export default CommandMenu;
