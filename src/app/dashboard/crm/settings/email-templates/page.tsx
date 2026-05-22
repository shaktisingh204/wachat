'use client';

/**
 * Email notification templates — settings page.
 *
 * Two-column layout:
 *   - Left rail: events grouped by category, with a "Customized" badge for
 *     any tenant override.
 *   - Right pane: the editor (subject, HTML body, variable chips, preview,
 *     Save / Test send / Restore default).
 *
 * Templates are scoped per-tenant via the current session userId. When no
 * override exists, the code default from `@/lib/email-templates/events`
 * is used.
 */

import * as React from 'react';
import { LoaderCircle, Mail, Search } from 'lucide-react';

import {
    Badge,
    Input,
    ZoruPageDescription,
    ZoruPageEyebrow,
    PageHeader,
    ZoruPageHeading,
    ZoruPageTitle,
} from '@/components/zoruui';
import { cn } from '@/components/zoruui/lib/cn';

import {
    getEmailTemplate,
    listEmailTemplates,
    type EmailTemplateDetail,
    type EmailTemplateListItem,
} from '@/app/actions/email-templates.actions';
import {
    EMAIL_EVENT_CATEGORIES,
    type EmailEventCategory,
} from '@/lib/email-templates/events';

import { EventTemplateEditor } from './_components/event-template-editor';

export default function EmailTemplatesSettingsPage(): React.JSX.Element {
    const [events, setEvents] = React.useState<EmailTemplateListItem[]>([]);
    const [listLoading, setListLoading] = React.useState(true);
    const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
    const [selectedDetail, setSelectedDetail] =
        React.useState<EmailTemplateDetail | null>(null);
    const [detailLoading, setDetailLoading] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const refreshList = React.useCallback(async () => {
        const items = await listEmailTemplates();
        setEvents(items);
        if (!selectedKey && items.length > 0) {
            setSelectedKey(items[0].eventKey);
        }
        setListLoading(false);
    }, [selectedKey]);

    React.useEffect(() => {
        void refreshList();
        // Intentional: we only want the initial fetch on mount; subsequent
        // refreshes happen after save / restore via `onPersisted`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadDetail = React.useCallback(async (key: string) => {
        setDetailLoading(true);
        try {
            const detail = await getEmailTemplate(key);
            setSelectedDetail(detail);
        } finally {
            setDetailLoading(false);
        }
    }, []);

    React.useEffect(() => {
        if (!selectedKey) return;
        void loadDetail(selectedKey);
    }, [selectedKey, loadDetail]);

    const handlePersisted = React.useCallback(() => {
        // Refresh both the list (for "Customized" badge) and the detail
        // (for updatedAt + isCustomized state).
        void refreshList();
        if (selectedKey) void loadDetail(selectedKey);
    }, [refreshList, loadDetail, selectedKey]);

    const filteredByCategory = React.useMemo(() => {
        const term = search.trim().toLowerCase();
        const filtered = term
            ? events.filter(
                  (e) =>
                      e.label.toLowerCase().includes(term) ||
                      e.eventKey.toLowerCase().includes(term) ||
                      e.description.toLowerCase().includes(term),
              )
            : events;
        const grouped = new Map<EmailEventCategory, EmailTemplateListItem[]>();
        for (const cat of EMAIL_EVENT_CATEGORIES) {
            grouped.set(cat.key, []);
        }
        for (const evt of filtered) {
            const bucket = grouped.get(evt.category);
            if (bucket) bucket.push(evt);
        }
        return grouped;
    }, [events, search]);

    const customizedCount = events.filter((e) => e.isCustomized).length;

    return (
        <div className="flex h-full flex-col gap-6">
            <ZoruPageHeader>
                <ZoruPageHeading>
                    <ZoruPageEyebrow>Settings</ZoruPageEyebrow>
                    <ZoruPageTitle>Email notification templates</ZoruPageTitle>
                    <ZoruPageDescription>
                        Customize the subject and HTML body of every notification
                        SabNode sends on your behalf. Overrides are scoped to your
                        workspace.
                    </ZoruPageDescription>
                </ZoruPageHeading>
                <div className="flex items-center gap-2 text-sm text-zoru-ink-muted">
                    <Mail className="h-4 w-4" />
                    <span>
                        {customizedCount} of {events.length} customized
                    </span>
                </div>
            </ZoruPageHeader>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
                {/* Left rail */}
                <aside className="flex min-h-0 flex-col overflow-hidden rounded-md border border-zoru-line bg-zoru-bg">
                    <div className="border-b border-zoru-line p-3">
                        <ZoruInput
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search events…"
                            leadingSlot={
                                <Search className="h-3.5 w-3.5 text-zoru-ink-subtle" />
                            }
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {listLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <LoaderCircle className="h-5 w-5 animate-spin text-zoru-ink-muted" />
                            </div>
                        ) : (
                            EMAIL_EVENT_CATEGORIES.map((cat) => {
                                const items = filteredByCategory.get(cat.key) ?? [];
                                if (items.length === 0) return null;
                                return (
                                    <div key={cat.key} className="mb-3">
                                        <h3 className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zoru-ink-subtle">
                                            {cat.label}
                                        </h3>
                                        <ul className="flex flex-col gap-0.5">
                                            {items.map((evt) => {
                                                const isActive = evt.eventKey === selectedKey;
                                                return (
                                                    <li key={evt.eventKey}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedKey(evt.eventKey)}
                                                            className={cn(
                                                                'flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left text-sm transition-colors',
                                                                isActive
                                                                    ? 'bg-zoru-ink text-zoru-bg'
                                                                    : 'text-zoru-ink hover:bg-zoru-bg-elev',
                                                            )}
                                                            aria-pressed={isActive}
                                                        >
                                                            <span className="min-w-0 truncate">
                                                                {evt.label}
                                                            </span>
                                                            {evt.isCustomized ? (
                                                                <ZoruBadge
                                                                    variant={isActive ? 'outline' : 'secondary'}
                                                                    className={cn(
                                                                        'shrink-0 text-[10px]',
                                                                        isActive && 'border-zoru-bg/40 text-zoru-bg',
                                                                    )}
                                                                >
                                                                    Custom
                                                                </ZoruBadge>
                                                            ) : null}
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                );
                            })
                        )}
                        {!listLoading &&
                        Array.from(filteredByCategory.values()).every(
                            (arr) => arr.length === 0,
                        ) ? (
                            <p className="px-2 py-8 text-center text-sm text-zoru-ink-subtle">
                                No events match &ldquo;{search}&rdquo;.
                            </p>
                        ) : null}
                    </div>
                </aside>

                {/* Right pane */}
                <section className="flex min-h-0 flex-col">
                    {detailLoading && !selectedDetail ? (
                        <div className="flex flex-1 items-center justify-center rounded-md border border-zoru-line bg-zoru-bg">
                            <LoaderCircle className="h-6 w-6 animate-spin text-zoru-ink-muted" />
                        </div>
                    ) : selectedDetail ? (
                        <EventTemplateEditor
                            key={selectedDetail.eventKey}
                            template={selectedDetail}
                            onPersisted={handlePersisted}
                        />
                    ) : (
                        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-zoru-line bg-zoru-bg p-8 text-center text-sm text-zoru-ink-muted">
                            Select an event from the list to customize its template.
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
