'use client';

/**
 * Grid of the user's saved templates with thumbnail, last-edited time,
 * and Edit / Use actions. "Use" lets the caller integrate the template
 * into a campaign (here we just emit a callback — the consuming page
 * decides what to do).
 */
import Link from 'next/link';
import { useMemo } from 'react';
import { FileText, PenLine, Sparkles, Trash2 } from 'lucide-react';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruEmptyState,
} from '@/components/zoruui';
import type { EmailTemplateDoc } from '@/lib/rust-client/email-templates';

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const diff = Date.now() - d;
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export interface TemplateGridProps {
  templates: EmailTemplateDoc[];
  onUse?: (template: EmailTemplateDoc) => void;
  onDelete?: (template: EmailTemplateDoc) => void;
  emptyCta?: React.ReactNode;
}

export function TemplateGrid({
  templates,
  onUse,
  onDelete,
  emptyCta,
}: TemplateGridProps) {
  const sorted = useMemo(
    () =>
      [...templates].sort((a, b) =>
        (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
      ),
    [templates],
  );

  if (sorted.length === 0) {
    return (
      <ZoruEmptyState
        icon={<FileText />}
        title="No templates yet"
        description="Create your first template to send branded campaigns."
        action={emptyCta}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sorted.map((t) => (
        <ZoruCard key={t._id} className="flex flex-col overflow-hidden">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-zoru-surface-2">
            {t.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.thumbnailUrl}
                alt={t.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <FileText className="h-8 w-8" />
              </div>
            )}
            {t.isLibrary ? (
              <ZoruBadge variant="outline" className="absolute right-2 top-2 gap-1 bg-card">
                <Sparkles className="h-3 w-3" /> Library
              </ZoruBadge>
            ) : null}
          </div>
          <ZoruCardHeader>
            <ZoruCardTitle className="line-clamp-1 text-sm">{t.name}</ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="flex-1 text-xs text-muted-foreground">
            {t.category ? <span className="mr-2">{t.category}</span> : null}
            <span>Updated {relativeTime(t.updatedAt)}</span>
          </ZoruCardContent>
          <ZoruCardFooter className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ZoruButton asChild type="button" variant="outline" size="sm">
                <Link href={`/dashboard/email/templates/${t._id}/builder`}>
                  <PenLine /> Edit
                </Link>
              </ZoruButton>
              {onUse ? (
                <ZoruButton
                  type="button"
                  size="sm"
                  onClick={() => onUse(t)}
                >
                  Use
                </ZoruButton>
              ) : null}
            </div>
            {onDelete ? (
              <ZoruButton
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Delete template"
                onClick={() => onDelete(t)}
                className="text-zoru-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </ZoruButton>
            ) : null}
          </ZoruCardFooter>
        </ZoruCard>
      ))}
    </div>
  );
}
