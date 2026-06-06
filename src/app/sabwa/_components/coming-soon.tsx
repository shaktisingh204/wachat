/**
 * ComingSoon — reusable "Phase 0" placeholder for SabWa pages.
 *
 * Renders a consistent header (icon tile + title + "Coming soon" badge +
 * description) and an optional "What's coming" card listing bullet
 * features. Used by every `/sabwa/*` page until its real implementation
 * lands.
 *
 * Server Component — no interactivity needed.
 *
 * @example
 *   <ComingSoon
 *     title="Inbox"
 *     icon={Inbox}
 *     description="WhatsApp-Web-style three-pane inbox."
 *     features={[
 *       "Virtualised chat list",
 *       "Composer with emoji, attachments, voice notes",
 *     ]}
 *   />
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Badge, Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';

export interface ComingSoonProps {
  /** Page title (e.g. "Inbox", "Bulk sender"). */
  title: string;
  /** Lucide icon shown in the tile. */
  icon: LucideIcon;
  /** One-sentence description placed under the title. */
  description: string;
  /** Optional bullets shown inside the "What's coming" card. */
  features?: string[];
  /** Optional override for the card title. */
  featuresTitle?: string;
  /** Optional override for the card description. */
  featuresDescription?: string;
}

export function ComingSoon({
  title,
  icon: Icon,
  description,
  features,
  featuresTitle = "What's coming",
  featuresDescription,
}: ComingSoonProps) {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--st-radius-lg)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--st-text)]">{title}</h1>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--st-text-secondary)]">{description}</p>
        </div>
      </header>

      {features && features.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{featuresTitle}</CardTitle>
            {featuresDescription ? (
              <CardDescription>{featuresDescription}</CardDescription>
            ) : null}
          </CardHeader>
          <CardBody>
            <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--st-text)]">
              {features.map((feature, i) => (
                <li key={i}>{feature}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

export default ComingSoon;
