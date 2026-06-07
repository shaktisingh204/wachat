'use client';

/**
 * SabCRM — reusable empty/zero-state components.
 *
 * A set of focused, parameterized empty-state renderers for common scenarios
 * across SabCRM: no records, no objects, no search results, no relations,
 * and generic error states. Each component wraps the Ui20 `EmptyState`
 * primitive and is tailored for a specific context (table, board, picker, etc.).
 *
 * All components are compositional and accept an optional `action` node,
 * permitting callers to inject contextual buttons (e.g. "Create New").
 * They are fully compatible with the `.ui20` CSS scope and inherit
 * the active dark/light theme.
 */

import * as React from 'react';
import { EmptyState, type EmptyStateProps } from '@/components/sabcrm/20ui';

// ─────────────────────────────────────────────────────────────────────────────
// No records / No results state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rendered when a table/board/list has no records at all.
 *
 * @param objectLabelSingular Singular human label (e.g., "Company", "Task").
 * @param action Optional action node (e.g., "Create New" button).
 */
export interface NoRecordsEmptyStateProps {
  objectLabelSingular: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function NoRecordsEmptyState({
  objectLabelSingular,
  action,
  icon,
  className,
}: NoRecordsEmptyStateProps): React.ReactElement {
  return (
    <EmptyState
      icon={icon}
      title={`No ${objectLabelSingular.toLowerCase()} yet`}
      description={`Create your first ${objectLabelSingular.toLowerCase()} to get started.`}
      action={action}
      className={className}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Search/filter with no matches state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rendered when a search or filter query returns zero results.
 *
 * @param query The search/filter term that yielded no matches.
 * @param action Optional action node (e.g., "Clear filters" button).
 */
export interface NoSearchResultsEmptyStateProps {
  query: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function NoSearchResultsEmptyState({
  query,
  action,
  icon,
  className,
}: NoSearchResultsEmptyStateProps): React.ReactElement {
  return (
    <EmptyState
      icon={icon}
      title="No matches"
      description={`Nothing matched "${query}".`}
      action={action}
      className={className}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// No objects state (CRM is empty)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rendered when there are no CRM objects (neither standard nor custom).
 * This is an extreme edge case — standard objects are seeded by default —
 * but included for completeness.
 *
 * @param action Optional action node (e.g., "Create your first object" button).
 */
export interface NoObjectsEmptyStateProps {
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function NoObjectsEmptyState({
  action,
  icon,
  className,
}: NoObjectsEmptyStateProps): React.ReactElement {
  return (
    <EmptyState
      icon={icon}
      title="No objects yet"
      description="Create or import an object to start managing records."
      action={action}
      className={className}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// No related records state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rendered when listing related records (e.g., companies linked to a person)
 * and none are found. Used in relation panels and pickers.
 *
 * @param relationLabel Human label of the relation (e.g., "Associated Companies").
 * @param action Optional action node (e.g., "Link a company" button).
 */
export interface NoRelatedRecordsEmptyStateProps {
  relationLabel: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function NoRelatedRecordsEmptyState({
  relationLabel,
  action,
  icon,
  className,
}: NoRelatedRecordsEmptyStateProps): React.ReactElement {
  return (
    <EmptyState
      icon={icon}
      title={`No ${relationLabel.toLowerCase()}`}
      description="Link related records to display them here."
      action={action}
      className={className}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// No activity/timeline state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rendered when a record's activity timeline is empty (no notes, tasks, or events).
 * Used in the activity timeline panel of a record detail view.
 *
 * @param action Optional action node (e.g., "Add a note" button).
 */
export interface NoActivityEmptyStateProps {
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function NoActivityEmptyState({
  action,
  icon,
  className,
}: NoActivityEmptyStateProps): React.ReactElement {
  return (
    <EmptyState
      icon={icon}
      title="No activity yet"
      description="Notes, tasks, and events will appear here."
      action={action}
      className={className}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// No assignments state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rendered when a user has no assigned records (in the "My Assignments" view).
 *
 * @param action Optional action node (e.g., "View all records" button).
 */
export interface NoAssignmentsEmptyStateProps {
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function NoAssignmentsEmptyState({
  action,
  icon,
  className,
}: NoAssignmentsEmptyStateProps): React.ReactElement {
  return (
    <EmptyState
      icon={icon}
      title="No assignments"
      description="Records assigned to you will appear here."
      action={action}
      className={className}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Picker/search results empty state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rendered when searching in a record picker (e.g., linking a relation) yields no results.
 * More compact than the general search empty state, suitable for inline pickers.
 *
 * @param query The search term that yielded no matches.
 * @param action Optional action node.
 */
export interface NoPickerResultsEmptyStateProps {
  query: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function NoPickerResultsEmptyState({
  query,
  action,
  icon,
  className,
}: NoPickerResultsEmptyStateProps): React.ReactElement {
  return (
    <EmptyState
      icon={icon}
      title="No results"
      description={`No records matched "${query}".`}
      action={action}
      compact
      className={className}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic/error state
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic empty state for custom scenarios. Falls back to the base Ui20
 * EmptyState when none of the above fit. Useful for errors or domain-specific
 * scenarios (e.g., "Import failed" or "Sync stalled").
 *
 * @param title The heading text.
 * @param description Optional explanatory text.
 * @param action Optional action node.
 * @param icon Optional icon node.
 */
export interface GenericEmptyStateProps
  extends Omit<EmptyStateProps, 'children'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function GenericEmptyState({
  title,
  description,
  action,
  icon,
  ...props
}: GenericEmptyStateProps): React.ReactElement {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={action}
      {...props}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton placeholder (compact, for table/board cells)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A compact empty-state variant for inline cells (e.g., an empty relation cell
 * in a table row or a loading skeleton in a picker). Renders a simple dashed box.
 *
 * @param label Optional single-line label (e.g., "Empty", "None").
 */
export interface CompactEmptyStateProps {
  label?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function CompactEmptyState({
  label,
  icon,
  className,
}: CompactEmptyStateProps): React.ReactElement {
  return (
    <EmptyState
      icon={icon}
      title={label || 'Empty'}
      compact
      className={className}
    />
  );
}
