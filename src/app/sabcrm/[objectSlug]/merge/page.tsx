"use client";

/**
 * SabCRM — Twenty-faithful "Merge records" screen (`/sabcrm/[objectSlug]/merge`).
 *
 * Resolves two duplicate records of the same object — a PRIMARY (the survivor)
 * and a SECONDARY (deleted on merge) — then lets the user pick, field by field,
 * which record's value wins. The chosen values are sent to the Rust engine via
 * `mergeSabcrmRecordsTw(object, primaryId, secondaryId, chosenData)`; on success
 * we route to the survivor's detail page.
 *
 * Flow:
 *   1. Pick PRIMARY + SECONDARY through search-as-you-type pickers
 *      (`searchRecordsForPickerAction`). `?primary=ID&secondary=ID` preselects.
 *   2. Once both are chosen, both records are fetched (`getSabcrmRecordTw`) and a
 *      two-tab wizard is rendered (mirroring Twenty's merge dialog):
 *        • FIELDS — one row per visible field, primary and secondary values
 *          side-by-side with a radio-style toggle to pick the winner (defaults
 *          to primary; falls back to secondary when primary empty). A
 *          "Conflicts only" switch filters to fields where the two sides differ.
 *        • PREVIEW — a read-only render of the RESULTING survivor: each field
 *          painted with `TwentyFieldValue` from the currently-winning side, so
 *          the user sees exactly what they're about to write, live.
 *   3. "Merge" → confirm dialog (warns the secondary is permanently deleted) →
 *      `mergeSabcrmRecordsTw` → `router.push('/sabcrm/{object}/{primaryId}')`.
 *
 * NO ZoruUI / Tailwind / clay — Twenty look only (`.st-*` from the kit plus the
 * sibling `merge.css` / `merge-preview.css`). Every data call is a gated server action returning an
 * `ActionResult`; the engine may be DOWN, so each branch degrades to an inline
 * banner / empty state and the page never crashes.
 */

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  AlertTriangle,
  Database,
  Loader2,
  ArrowRight,
  X,
  GitMerge,
  ArrowLeft,
  Columns3,
  Eye,
  Check,
} from "lucide-react";

import { TwentyPageHeader, TwentyButton } from "@/components/sabcrm/twenty";
import { TwentyFieldValue } from "@/components/sabcrm/twenty/twenty-field";
import { Modal, Button } from "@/components/sabcrm/20ui";
import { useProject } from "@/context/project-context";
import {
  listSabcrmObjectsTw,
  getSabcrmRecordTw,
  mergeSabcrmRecordsTw,
} from "@/app/actions/sabcrm-twenty.actions";
import { searchRecordsForPickerAction } from "@/app/actions/sabcrm.actions";
import type { SabcrmRustRecord } from "@/app/actions/sabcrm-twenty.actions.types";
import type { SabcrmPickerOption } from "@/app/actions/sabcrm.actions.types";
import type { ObjectMetadata, FieldMetadata } from "@/lib/sabcrm/types";
import { sabcrmRecordLabel } from "@/lib/sabcrm/record-label";

import "./merge.css";
import "./merge-preview.css";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEARCH_DEBOUNCE_MS = 300;

/** Which record a field value should be taken from on merge. */
type Side = "primary" | "secondary";

/** Which top-level wizard tab is active. */
type MergeTab = "fields" | "preview";

/** Treat null / undefined / empty-string as "no value". */
function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** Whether two stored field values are equivalent (so there's no conflict). */
function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Resolve a record's display label from the object's `isLabel` field. */
function recordLabel(object: ObjectMetadata, record: SabcrmRustRecord): string {
  return sabcrmRecordLabel(object, record);
}

/**
 * Fields shown in the comparison table — anything the user can meaningfully
 * pick a value for. System + relation fields are skipped (relations are merged
 * structurally by the engine, system columns are owned by it).
 */
function mergeableFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter((f) => !f.system && f.type !== "RELATION");
}

// ---------------------------------------------------------------------------
// Record picker (search-as-you-type)
// ---------------------------------------------------------------------------

interface RecordPickerProps {
  object: ObjectMetadata;
  projectId: string | null;
  role: Side;
  /** Currently chosen record (resolved), or `null` while empty. */
  chosen: SabcrmRustRecord | null;
  /** The other side's id — excluded from results (can't merge a record with itself). */
  excludeId: string | null;
  onChoose: (id: string) => void;
  onClear: () => void;
}

function RecordPicker({
  object,
  projectId,
  role,
  chosen,
  excludeId,
  onChoose,
  onClear,
}: RecordPickerProps): React.JSX.Element {
  const [input, setInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SabcrmPickerOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  // Debounce the search input.
  React.useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  // Run the picker search whenever the (debounced) query changes and the
  // dropdown is open. Gracefully surfaces engine-down as an inline message.
  React.useEffect(() => {
    if (!open || chosen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await searchRecordsForPickerAction(
        object.slug,
        query,
        20,
        projectId ?? undefined,
      );
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setResults([]);
      } else {
        setResults(res.data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, query, chosen, object.slug, projectId]);

  const isPrimary = role === "primary";

  if (chosen) {
    return (
      <div
        className={`st-merge-picker${isPrimary ? " st-merge-picker--primary" : ""}`}
      >
        <span className="st-merge-picker__label">
          {isPrimary ? "Primary" : "Secondary"}
          <span
            className={`st-merge-picker__badge ${
              isPrimary
                ? "st-merge-picker__badge--keep"
                : "st-merge-picker__badge--delete"
            }`}
          >
            {isPrimary ? "Survivor" : "Will be deleted"}
          </span>
        </span>
        <div className="st-merge-picker__chosen">
          <span className="st-merge-picker__chosen-label">
            {recordLabel(object, chosen)}
          </span>
          <button
            type="button"
            className="st-merge-picker__clear"
            onClick={onClear}
            aria-label="Clear selection"
            title="Clear selection"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`st-merge-picker${isPrimary ? " st-merge-picker--primary" : ""}`}
    >
      <span className="st-merge-picker__label">
        {isPrimary ? "Primary" : "Secondary"}
        <span className="st-merge-picker__role">
          {isPrimary ? "(survivor)" : "(deleted on merge)"}
        </span>
      </span>
      <div className="st-merge-search">
        <div className="st-search">
          <Search className="st-search__icon" size={15} aria-hidden="true" />
          <input
            className="st-search__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setOpen(true)}
            // Delay close so a result click registers before blur unmounts it.
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={`Search ${object.labelPlural.toLowerCase()}…`}
            aria-label={`Search ${isPrimary ? "primary" : "secondary"} ${object.labelPlural}`}
          />
        </div>
        {open && (
          <div className="st-merge-search__results">
            {loading ? (
              <div className="st-merge-search__loading">
                <Loader2 size={14} className="st-spin" />
                Searching…
              </div>
            ) : error ? (
              <div className="st-banner" role="alert">
                <AlertTriangle className="st-banner__icon" size={14} />
                <span>{error}</span>
              </div>
            ) : results.length === 0 ? (
              <div className="st-merge-search__empty">
                {query
                  ? `No ${object.labelPlural.toLowerCase()} match “${query}”.`
                  : `Start typing to find a ${object.labelSingular.toLowerCase()}.`}
              </div>
            ) : (
              results.map((opt) => {
                const isExcluded = opt.id === excludeId;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className="st-merge-search__item"
                    disabled={isExcluded}
                    title={
                      isExcluded
                        ? "Already chosen on the other side"
                        : undefined
                    }
                    // onMouseDown so it fires before the input's blur.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (isExcluded) return;
                      onChoose(opt.id);
                      setInput("");
                      setOpen(false);
                    }}
                  >
                    {opt.label || `${object.labelSingular} ${opt.id.slice(-6)}`}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  object: ObjectMetadata;
  primaryName: string;
  secondaryName: string;
  merging: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  object,
  primaryName,
  secondaryName,
  merging,
  onCancel,
  onConfirm,
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Modal
      open
      // Escape, overlay click, and the close button all route here — suppress
      // every dismissal path while the merge is mid-flight (matches the prior
      // disabled close + non-dismissable overlay behaviour).
      onClose={merging ? () => {} : onCancel}
      title={`Merge ${object.labelPlural.toLowerCase()}?`}
      footer={
        <>
          <TwentyButton
            variant="secondary"
            onClick={onCancel}
            disabled={merging}
          >
            Cancel
          </TwentyButton>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={merging}
            loading={merging}
          >
            Merge &amp; delete secondary
          </Button>
        </>
      }
    >
      <div className="st-merge-confirm__warn">
        <AlertTriangle
          className="st-merge-confirm__warn-icon"
          size={16}
          aria-hidden="true"
        />
        <span>
          The chosen values will be written onto{" "}
          <span className="st-merge-confirm__name">{primaryName}</span>, and{" "}
          <span className="st-merge-confirm__name">{secondaryName}</span> will
          be <strong>permanently deleted</strong>. This cannot be undone.
        </span>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="st-banner" role="alert">
      <AlertTriangle className="st-banner__icon" size={15} />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmMergePage(): React.JSX.Element {
  const params = useParams<{ objectSlug: string }>();
  const objectSlug = params?.objectSlug ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeProjectId } = useProject();

  const [object, setObject] = React.useState<ObjectMetadata | null>(null);
  const [loadingObject, setLoadingObject] = React.useState(true);
  const [objectError, setObjectError] = React.useState<string | null>(null);

  // Chosen record ids (from pickers or query params) and their resolved records.
  const [primaryId, setPrimaryId] = React.useState<string | null>(
    searchParams?.get("primary") ?? null,
  );
  const [secondaryId, setSecondaryId] = React.useState<string | null>(
    searchParams?.get("secondary") ?? null,
  );
  const [primary, setPrimary] = React.useState<SabcrmRustRecord | null>(null);
  const [secondary, setSecondary] = React.useState<SabcrmRustRecord | null>(
    null,
  );
  const [loadingRecords, setLoadingRecords] = React.useState(false);
  const [recordsError, setRecordsError] = React.useState<string | null>(null);

  // Per-field chosen side. Defaults to primary; secondary when primary is empty.
  const [choices, setChoices] = React.useState<Record<string, Side>>({});

  // Wizard tab (Fields winner-picker vs. read-only Preview) + Fields filter.
  const [tab, setTab] = React.useState<MergeTab>("fields");
  const [conflictsOnly, setConflictsOnly] = React.useState(false);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [merging, setMerging] = React.useState(false);
  const [mergeError, setMergeError] = React.useState<string | null>(null);

  // Load object metadata.
  React.useEffect(() => {
    let cancelled = false;
    setLoadingObject(true);
    setObjectError(null);
    (async () => {
      const res = await listSabcrmObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      if (!res.ok) {
        setObjectError(res.error);
        setObject(null);
      } else {
        setObject(res.data.find((o) => o.slug === objectSlug) ?? null);
      }
      setLoadingObject(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, activeProjectId]);

  // Resolve the chosen record ids into full records. Each side loads
  // independently so one failing doesn't blank the other.
  React.useEffect(() => {
    if (!objectSlug || !primaryId) {
      setPrimary(null);
      return;
    }
    let cancelled = false;
    setLoadingRecords(true);
    setRecordsError(null);
    (async () => {
      const res = await getSabcrmRecordTw(
        objectSlug,
        primaryId,
        activeProjectId ?? undefined,
      );
      if (cancelled) return;
      if (!res.ok) {
        setRecordsError(res.error);
        setPrimary(null);
      } else {
        setPrimary(res.data);
      }
      setLoadingRecords(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, primaryId, activeProjectId]);

  React.useEffect(() => {
    if (!objectSlug || !secondaryId) {
      setSecondary(null);
      return;
    }
    let cancelled = false;
    setLoadingRecords(true);
    setRecordsError(null);
    (async () => {
      const res = await getSabcrmRecordTw(
        objectSlug,
        secondaryId,
        activeProjectId ?? undefined,
      );
      if (cancelled) return;
      if (!res.ok) {
        setRecordsError(res.error);
        setSecondary(null);
      } else {
        setSecondary(res.data);
      }
      setLoadingRecords(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, secondaryId, activeProjectId]);

  const fields = React.useMemo(
    () => (object ? mergeableFields(object) : []),
    [object],
  );

  // Seed per-field choices whenever both records are resolved: default to
  // primary, but fall back to secondary when the primary value is empty and the
  // secondary has one. Resets if either record changes.
  React.useEffect(() => {
    if (!primary || !secondary || fields.length === 0) {
      setChoices({});
      return;
    }
    const next: Record<string, Side> = {};
    for (const f of fields) {
      const pVal = primary.data[f.key];
      const sVal = secondary.data[f.key];
      next[f.key] = isEmpty(pVal) && !isEmpty(sVal) ? "secondary" : "primary";
    }
    setChoices(next);
  }, [primary, secondary, fields]);

  const bothChosen = !!primary && !!secondary;

  // Fields whose primary / secondary values actually differ (the conflicts the
  // user must resolve). Drives the "Conflicts only" filter and tab counts.
  const conflictFields = React.useMemo(() => {
    if (!primary || !secondary) return [] as FieldMetadata[];
    return fields.filter(
      (f) => !valuesEqual(primary.data[f.key], secondary.data[f.key]),
    );
  }, [primary, secondary, fields]);

  // Build the chosen-data payload: for each field, the value from the winning
  // side. (Sending the full resolved set keeps the engine merge explicit.)
  const buildChosenData = React.useCallback((): Record<string, unknown> => {
    if (!primary || !secondary) return {};
    const data: Record<string, unknown> = {};
    for (const f of fields) {
      const side = choices[f.key] ?? "primary";
      const src = side === "primary" ? primary : secondary;
      data[f.key] = src.data[f.key];
    }
    return data;
  }, [primary, secondary, fields, choices]);

  const handleMerge = React.useCallback(async () => {
    if (!primaryId || !secondaryId || merging) return;
    setMerging(true);
    setMergeError(null);

    const res = await mergeSabcrmRecordsTw(
      objectSlug,
      primaryId,
      secondaryId,
      buildChosenData(),
      activeProjectId ?? undefined,
    );

    if (!res.ok) {
      setMerging(false);
      setMergeError(res.error);
      setConfirmOpen(false);
      return;
    }
    // Success — route to the survivor's detail page.
    setConfirmOpen(false);
    router.push(`/sabcrm/${objectSlug}/${primaryId}`);
  }, [
    primaryId,
    secondaryId,
    merging,
    objectSlug,
    buildChosenData,
    activeProjectId,
    router,
  ]);

  // ---- Render -------------------------------------------------------------

  if (loadingObject) {
    return (
      <div className="st-page">
        <div
          className="st-skeleton"
          style={{ height: 28, width: 220, marginBottom: 20 }}
        />
        <div
          className="st-skeleton"
          style={{ height: 120, marginBottom: 16 }}
        />
        <div className="st-skeleton" style={{ height: 240 }} />
      </div>
    );
  }

  if (objectError && !object) {
    return (
      <div className="st-page">
        <ErrorBanner message={objectError} />
      </div>
    );
  }

  if (!object) {
    return (
      <div className="st-page">
        <div className="st-empty">
          <span className="st-empty__icon">
            <Database size={20} />
          </span>
          <h2 className="st-empty__title">Object not found</h2>
          <p className="st-empty__desc">
            No CRM object matches “{objectSlug}”. It may have been removed or
            you may not have access.
          </p>
          <TwentyButton variant="secondary">
            <Link
              href="/sabcrm"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Back to SabCRM
            </Link>
          </TwentyButton>
        </div>
      </div>
    );
  }

  const primaryName = primary
    ? recordLabel(object, primary)
    : "the primary record";
  const secondaryName = secondary
    ? recordLabel(object, secondary)
    : "the secondary record";

  return (
    <div className="st-page">
      <TwentyPageHeader
        title={`Merge ${object.labelPlural}`}
        actions={
          <TwentyButton variant="secondary" icon={ArrowLeft}>
            <Link
              href={`/sabcrm/${object.slug}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Back to {object.labelPlural.toLowerCase()}
            </Link>
          </TwentyButton>
        }
      />

      {mergeError && <ErrorBanner message={mergeError} />}

      {/* Pickers */}
      <div className="st-merge-pickers">
        <RecordPicker
          object={object}
          projectId={activeProjectId}
          role="primary"
          chosen={primary}
          excludeId={secondaryId}
          onChoose={(id) => {
            setMergeError(null);
            setPrimaryId(id);
          }}
          onClear={() => {
            setPrimaryId(null);
            setPrimary(null);
          }}
        />
        <div className="st-merge-pickers__arrow" aria-hidden="true">
          <ArrowRight size={18} />
        </div>
        <RecordPicker
          object={object}
          projectId={activeProjectId}
          role="secondary"
          chosen={secondary}
          excludeId={primaryId}
          onChoose={(id) => {
            setMergeError(null);
            setSecondaryId(id);
          }}
          onClear={() => {
            setSecondaryId(null);
            setSecondary(null);
          }}
        />
      </div>

      {recordsError && <ErrorBanner message={recordsError} />}

      {/* Comparison table */}
      {loadingRecords && !bothChosen ? (
        <div className="st-skeleton" style={{ height: 240 }} />
      ) : !bothChosen ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <GitMerge size={20} />
          </span>
          <h2 className="st-empty__title">
            Choose two {object.labelPlural.toLowerCase()}
          </h2>
          <p className="st-empty__desc">
            Pick a <strong>primary</strong> record to keep and a{" "}
            <strong>secondary</strong> record to merge into it. You’ll then
            choose which value wins for each field.
          </p>
        </div>
      ) : (
        <>
          {/* Wizard tabs — Fields (winner picker) / Preview (survivor). */}
          <div
            className="st-merge-tabs"
            role="tablist"
            aria-label="Merge sections"
          >
            <button
              type="button"
              role="tab"
              id="st-merge-tab-fields"
              aria-controls="st-merge-panel-fields"
              aria-selected={tab === "fields"}
              className={`st-merge-tab${tab === "fields" ? " is-active" : ""}`}
              onClick={() => setTab("fields")}
            >
              <Columns3 size={14} aria-hidden="true" />
              Fields
              {conflictFields.length > 0 ? (
                <span className="st-merge-tab__count">
                  {conflictFields.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              id="st-merge-tab-preview"
              aria-controls="st-merge-panel-preview"
              aria-selected={tab === "preview"}
              className={`st-merge-tab${tab === "preview" ? " is-active" : ""}`}
              onClick={() => setTab("preview")}
            >
              <Eye size={14} aria-hidden="true" />
              Preview
            </button>
          </div>

          {tab === "fields" ? (
            <div
              role="tabpanel"
              id="st-merge-panel-fields"
              aria-labelledby="st-merge-tab-fields"
            >
              <div className="st-merge-toolbar">
                <span className="st-merge-toolbar__hint">
                  {conflictFields.length === 0
                    ? "No conflicting fields — both records agree."
                    : `${conflictFields.length} field${
                        conflictFields.length === 1 ? "" : "s"
                      } differ between these records.`}
                </span>
                <label className="st-merge-toggle">
                  <input
                    type="checkbox"
                    checked={conflictsOnly}
                    onChange={(e) => setConflictsOnly(e.target.checked)}
                  />
                  <span className="st-merge-toggle__track" aria-hidden="true">
                    <span className="st-merge-toggle__thumb" />
                  </span>
                  Conflicts only
                </label>
              </div>

              {conflictsOnly && conflictFields.length === 0 ? (
                <div className="st-merge-noconflicts">
                  <Check size={15} aria-hidden="true" />
                  These records have no conflicting fields. Toggle off
                  “Conflicts only” to review every field.
                </div>
              ) : (
                <div className="st-merge-compare">
                  <div className="st-merge-compare__head">
                    <span>Field</span>
                    <span>{primaryName}</span>
                    <span>{secondaryName}</span>
                  </div>
                  {(conflictsOnly ? conflictFields : fields).map((field) => {
                    const pVal = primary!.data[field.key];
                    const sVal = secondary!.data[field.key];
                    const side = choices[field.key] ?? "primary";
                    const sameValue = valuesEqual(pVal, sVal);
                    return (
                      <div className="st-merge-row" key={field.key}>
                        <div className="st-merge-row__field">{field.label}</div>
                        <button
                          type="button"
                          className={`st-merge-opt${side === "primary" ? " is-chosen" : ""}`}
                          aria-pressed={side === "primary"}
                          onClick={() =>
                            setChoices((prev) => ({
                              ...prev,
                              [field.key]: "primary",
                            }))
                          }
                        >
                          <span
                            className="st-merge-opt__dot"
                            aria-hidden="true"
                          />
                          <span className="st-merge-opt__value">
                            <TwentyFieldValue field={field} value={pVal} />
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`st-merge-opt${side === "secondary" ? " is-chosen" : ""}`}
                          aria-pressed={side === "secondary"}
                          // When both sides hold the same value, picking is moot —
                          // keep primary and disable the secondary tile for clarity.
                          disabled={sameValue}
                          onClick={() =>
                            setChoices((prev) => ({
                              ...prev,
                              [field.key]: "secondary",
                            }))
                          }
                        >
                          <span
                            className="st-merge-opt__dot"
                            aria-hidden="true"
                          />
                          <span className="st-merge-opt__value">
                            <TwentyFieldValue field={field} value={sVal} />
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Preview — what the survivor looks like with current selections. */
            <div
              role="tabpanel"
              id="st-merge-panel-preview"
              aria-labelledby="st-merge-tab-preview"
              className="st-merge-preview"
            >
              <div className="st-merge-preview__head">
                <span className="st-merge-preview__title">{primaryName}</span>
                <span className="st-merge-preview__badge">After merge</span>
              </div>
              {fields.map((field) => {
                const side = choices[field.key] ?? "primary";
                const src = side === "primary" ? primary! : secondary!;
                const value = src.data[field.key];
                return (
                  <div className="st-merge-preview__row" key={field.key}>
                    <div className="st-merge-preview__label">{field.label}</div>
                    <div className="st-merge-preview__value">
                      <TwentyFieldValue field={field} value={value} />
                      {side === "secondary" ? (
                        <span className="st-merge-preview__src st-merge-preview__src--secondary">
                          from secondary
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="st-merge-actions">
            <span className="st-merge-actions__note">
              <AlertTriangle size={14} aria-hidden="true" />
              {secondaryName} will be deleted on merge.
            </span>
            <button
              type="button"
              className="st-btn st-btn--danger"
              onClick={() => setConfirmOpen(true)}
              disabled={merging}
            >
              <GitMerge size={14} aria-hidden="true" />
              Merge {object.labelPlural.toLowerCase()}
            </button>
          </div>
        </>
      )}

      {confirmOpen && bothChosen && (
        <ConfirmDialog
          object={object}
          primaryName={primaryName}
          secondaryName={secondaryName}
          merging={merging}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleMerge}
        />
      )}
    </div>
  );
}
