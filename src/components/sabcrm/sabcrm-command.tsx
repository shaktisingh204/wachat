"use client";

/**
 * SabCRM command palette (⌘K).
 *
 * A first-party command surface for the metadata-driven SabCRM. It exposes
 * three classes of action, all derived from the object catalogue the shell
 * already resolves (no extra object fetch):
 *
 *   1. **Jump** — navigate to any object's list view (`/sabcrm/<slug>`).
 *   2. **Create** — create a blank record of any object via the gated
 *      {@link createRecordAction}, then route to the new record's detail page
 *      (`/sabcrm/<slug>/<id>`), mirroring the object index page's create flow.
 *   3. **Search** — global record search across every object via the gated
 *      {@link searchRecordsForPickerAction}, fanned out per object slug and
 *      merged into one "Records" group. Hits route to the record detail page.
 *
 * Built on the ZoruUI cmdk primitives (`CommandDialog` and friends) so it
 * inherits the black-&-white ZoruUI design tokens and the shared dialog/overlay
 * behaviour. cmdk owns filtering for the static (jump/create) entries; the async
 * record results are appended verbatim (cmdk `shouldFilter={false}` would hide
 * them, so each record item carries an explicit `value` that always matches the
 * live query — see `RECORD_VALUE_PREFIX`).
 *
 * Every server action it calls (`createRecordAction`,
 * `searchRecordsForPickerAction`) independently runs the full
 * session → project → RBAC → plan gate, so this component holds no privileges of
 * its own: a denied caller simply gets empty results / a failed create.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { icons as lucideIcons, Database, Plus, FileText } from "lucide-react";

import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut } from '@/components/sabcrm/20ui';
import {
  createRecordAction,
  searchRecordsForPickerAction,
} from "@/app/actions/sabcrm.actions";
import type { SabcrmPickerOption } from "@/app/actions/sabcrm.actions.types";
import type { ObjectMetadata } from "@/lib/sabcrm/types";

/** Base route every SabCRM page lives under (matches the live page links). */
const CRM_BASE_PATH = "/sabcrm";

/** Debounce window for the global record search. */
const SEARCH_DEBOUNCE_MS = 220;
/** Per-object cap for search hits, and the max number of objects we fan out to. */
const SEARCH_PER_OBJECT = 5;
const SEARCH_MAX_OBJECTS = 8;

/**
 * cmdk filters items by matching the query against each item's `value`. Record
 * hits are already server-filtered, so we give them a value that always contains
 * the current query — guaranteeing cmdk keeps them visible regardless of how the
 * label matches.
 */
const RECORD_VALUE_PREFIX = "record-hit";

export interface SabcrmCommandProps {
  /** The object catalogue (standard + custom) for the active project. */
  objects: ObjectMetadata[];
  /** Optional explicit project id forwarded to the gated server actions. */
  projectId?: string;
  /** Controlled open state. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A record hit tagged with its parent object for icon + routing. */
interface RecordHit {
  option: SabcrmPickerOption;
  object: ObjectMetadata;
}

/**
 * Resolve a lucide icon name (as stored on {@link ObjectMetadata.icon}) to a
 * node. `lucide-react` exposes every icon on its `icons` map by PascalCase name;
 * we fall back to a neutral glyph.
 */
function objectIcon(name: string | undefined): React.ReactNode {
  if (name && name in lucideIcons) {
    const Icon = lucideIcons[name as keyof typeof lucideIcons];
    return <Icon />;
  }
  return <Database />;
}

export function SabcrmCommand({
  objects,
  projectId,
  open,
  onOpenChange,
}: SabcrmCommandProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<RecordHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [creatingSlug, setCreatingSlug] = React.useState<string | null>(null);
  // Monotonic request id so out-of-order async search responses are ignored.
  const reqIdRef = React.useRef(0);

  // Reset transient state whenever the palette opens.
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setHits([]);
      setSearching(false);
      setCreatingSlug(null);
    }
  }, [open]);

  const close = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const goTo = React.useCallback(
    (href: string) => {
      router.push(href);
      close();
    },
    [router, close],
  );

  const createIn = React.useCallback(
    async (slug: string) => {
      if (creatingSlug) return;
      setCreatingSlug(slug);
      const res = await createRecordAction(slug, {}, projectId);
      setCreatingSlug(null);
      if (res.ok) {
        router.push(`${CRM_BASE_PATH}/${slug}/${res.data._id}`);
        close();
      }
    },
    [creatingSlug, projectId, router, close],
  );

  // Index objects by slug so search hits can resolve their parent object.
  const objectsBySlug = React.useMemo(() => {
    const map = new Map<string, ObjectMetadata>();
    for (const o of objects) map.set(o.slug, o);
    return map;
  }, [objects]);

  // Debounced global record search, fanned out across objects.
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    const myReq = ++reqIdRef.current;
    setSearching(true);
    const handle = setTimeout(() => {
      const targets = objects.slice(0, SEARCH_MAX_OBJECTS);
      void Promise.all(
        targets.map((obj) =>
          searchRecordsForPickerAction(
            obj.slug,
            q,
            SEARCH_PER_OBJECT,
            projectId,
          ),
        ),
      ).then((results) => {
        if (myReq !== reqIdRef.current) return; // superseded
        const merged: RecordHit[] = [];
        results.forEach((res, i) => {
          if (!res.ok) return;
          const obj = targets[i];
          for (const option of res.data) merged.push({ option, object: obj });
        });
        setHits(merged);
        setSearching(false);
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [open, query, objects, projectId]);

  const hasQuery = query.trim().length >= 2;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="SabCRM command palette"
    >
      {/* cmdk owns filtering for the static jump/create groups. */}
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search records or jump to an object…"
      />
      <CommandList>
        <CommandEmpty>
          {searching ? "Searching…" : "No results found."}
        </CommandEmpty>

        {/* Global record search results */}
        {hits.length > 0 && (
          <CommandGroup heading="Records">
            {hits.map(({ option, object }) => (
              <CommandItem
                key={`${option.object}:${option.id}`}
                // Always-matching value so cmdk keeps server hits visible.
                value={`${RECORD_VALUE_PREFIX} ${query} ${option.label} ${option.id}`}
                onSelect={() =>
                  goTo(`${CRM_BASE_PATH}/${option.object}/${option.id}`)
                }
              >
                {objectIcon(object.icon)}
                <span className="truncate">{option.label || "Untitled"}</span>
                <CommandShortcut>
                  {object.labelSingular}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Jump to an object's list view */}
        <CommandGroup heading="Navigate">
          {objects.map((obj) => (
            <CommandItem
              key={`jump:${obj.slug}`}
              value={`open ${obj.labelPlural} ${obj.labelSingular} ${obj.slug}`}
              onSelect={() => goTo(`${CRM_BASE_PATH}/${obj.slug}`)}
            >
              {objectIcon(obj.icon)}
              <span className="truncate">{obj.labelPlural}</span>
              <CommandShortcut>Open</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Create a new record */}
        <CommandGroup heading="Create">
          {objects.map((obj) => (
            <CommandItem
              key={`create:${obj.slug}`}
              value={`create new add ${obj.labelSingular} ${obj.labelPlural} ${obj.slug}`}
              disabled={creatingSlug !== null}
              onSelect={() => {
                void createIn(obj.slug);
              }}
            >
              <Plus />
              <span className="truncate">Create {obj.labelSingular}</span>
              <CommandShortcut>
                {creatingSlug === obj.slug ? "Creating…" : "New"}
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Hint row when a record search is pending but nothing has resolved. */}
        {hasQuery && searching && hits.length === 0 && (
          <CommandGroup heading="Records">
            <CommandItem value={`${RECORD_VALUE_PREFIX} ${query}`} disabled>
              <FileText />
              <span className="truncate text-[var(--st-text-secondary)]">
                Searching records…
              </span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
