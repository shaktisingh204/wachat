'use client';

import * as React from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Badge,
  cn,
} from '@/components/sabcrm/20ui';
import { Check, X } from 'lucide-react';
import {
  PLAN_FEATURE_GROUPS,
  sabcrmPlanFeature,
  type PlanFeatureEntry,
  type PlanFeatureGroup,
} from '@/lib/plans';
import type { PlanFeaturePermissions } from '@/lib/definitions';

export interface PlanFeatureGroupsProps {
  /** Plan entitlement snapshot. Missing keys default to ENABLED. */
  features?: Partial<PlanFeaturePermissions> | null;
  /** Accordion mode. `multiple` lets users compare groups side by side. */
  type?: 'single' | 'multiple';
  /** Group keys open initially. Defaults to the first visible group. */
  defaultOpen?: string[];
  /** Append the SabCRM entitlement row to the Sab Apps group. */
  includeSabcrm?: boolean;
  /** Also render groups/features for modules hidden from end users. */
  showHidden?: boolean;
  className?: string;
}

interface ResolvedFeature {
  id: string;
  name: string;
  icon: React.ElementType;
  included: boolean;
}

function FeatureRow({ feature }: { feature: ResolvedFeature }) {
  const FeatureIcon = feature.icon;
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={cn(
          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[var(--st-radius-sm)]',
          feature.included
            ? 'bg-[var(--st-accent-soft)] text-[var(--st-accent)]'
            : 'bg-[var(--st-bg-secondary)] text-[var(--st-text-tertiary)]',
        )}
        aria-hidden="true"
      >
        {FeatureIcon ? <FeatureIcon className="h-3.5 w-3.5" /> : null}
      </span>
      <span
        className={cn(
          'flex-1 text-sm text-[var(--st-text)]',
          !feature.included && 'text-[var(--st-text-tertiary)] line-through',
        )}
      >
        {feature.name}
      </span>
      {feature.included ? (
        <Check className="h-4 w-4 flex-shrink-0 text-[var(--st-status-ok)]" aria-hidden="true" />
      ) : (
        <X className="h-4 w-4 flex-shrink-0 text-[var(--st-text-tertiary)]" aria-hidden="true" />
      )}
    </li>
  );
}

function visibleFeatures(group: PlanFeatureGroup, showHidden: boolean): PlanFeatureEntry[] {
  if (showHidden) return group.features;
  return group.features.filter((f) => !f.hiddenFromUsers);
}

/** The grouped, user-visible feature list with hidden-module entries filtered out. */
export function getVisiblePlanFeatureGroups(showHidden = false): PlanFeatureGroup[] {
  return PLAN_FEATURE_GROUPS.filter((g) => showHidden || !g.hiddenFromUsers)
    .map((g) => ({ ...g, features: visibleFeatures(g, showHidden) }))
    .filter((g) => g.features.length > 0);
}

/**
 * Grouped, collapsible plan-entitlement list — replaces the old flat
 * "wall of 70+ checklist rows". Each group is an accordion section with an
 * "X of Y included" count so the plan is scannable while collapsed.
 */
export function PlanFeatureGroups({
  features,
  type = 'multiple',
  defaultOpen,
  includeSabcrm = true,
  showHidden = false,
  className,
}: PlanFeatureGroupsProps) {
  const groups = React.useMemo(() => {
    const isIncluded = (id: string) =>
      (features as Record<string, boolean | undefined> | null | undefined)?.[id] ?? true;

    return getVisiblePlanFeatureGroups(showHidden).map((group) => {
      const rows: ResolvedFeature[] = group.features.map((f) => ({
        id: f.id,
        name: f.name,
        icon: f.icon,
        included: isIncluded(f.id),
      }));
      // SabCRM is gated outside PlanFeaturePermissions (see lib/plans.ts) but
      // belongs with the Sab apps in the user-facing entitlement list.
      if (includeSabcrm && group.key === 'sab-apps') {
        rows.push({
          id: sabcrmPlanFeature.id,
          name: sabcrmPlanFeature.name,
          icon: sabcrmPlanFeature.icon,
          included:
            (features as Record<string, boolean | undefined> | null | undefined)?.[
              sabcrmPlanFeature.id
            ] ?? sabcrmPlanFeature.defaultEnabled,
        });
      }
      const includedCount = rows.filter((r) => r.included).length;
      return { ...group, rows, includedCount };
    });
  }, [features, includeSabcrm, showHidden]);

  if (groups.length === 0) return null;

  const openDefault = defaultOpen ?? [groups[0].key];

  const accordionProps =
    type === 'single'
      ? ({ type: 'single', collapsible: true, defaultValue: openDefault[0] } as const)
      : ({ type: 'multiple', defaultValue: openDefault } as const);

  return (
    <Accordion {...accordionProps} className={className}>
      {groups.map((group) => {
        const GroupIcon = group.icon;
        const allIncluded = group.includedCount === group.rows.length;
        return (
          <AccordionItem key={group.key} value={group.key}>
            <AccordionTrigger>
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                  aria-hidden="true"
                >
                  {GroupIcon ? <GroupIcon className="h-3.5 w-3.5" /> : null}
                </span>
                <span className="truncate text-sm font-medium text-[var(--st-text)]">
                  {group.label}
                </span>
                <Badge tone={allIncluded ? 'accent' : 'neutral'} kind="soft" className="tabular-nums">
                  {allIncluded
                    ? `All ${group.rows.length} included`
                    : `${group.includedCount} of ${group.rows.length} included`}
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="grid grid-cols-1 gap-x-[var(--st-space-6)] gap-y-[var(--st-space-2)] sm:grid-cols-2">
                {group.rows.map((row) => (
                  <FeatureRow key={row.id} feature={row} />
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
