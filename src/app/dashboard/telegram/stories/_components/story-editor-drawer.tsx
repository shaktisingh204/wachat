import React from 'react';
import {
  Button,
  DatePicker,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  Input,
  Label,
  RadioGroup,
  ZoruRadioGroupItem,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Switch,
  Textarea,
} from '@/components/sabcrm/20ui/compat';
import { ImageIcon, Loader2, Plus, VideoIcon } from 'lucide-react';
import { SabFileUrlInput } from '@/components/sabfiles';
import { AreaEditor, AreaDraft } from './area-editor';
import type {
  StoryType,
  StoryMediaKind,
  StoryPrivacyKind,
  StoryActivePeriodSeconds,
  BusinessConnectionRow,
} from '@/lib/rust-client/telegram-stories';
import type { BotRow } from '@/lib/rust-client/telegram-bots';
import type { ChannelRow } from '@/lib/rust-client/telegram-channels';

export interface FormState {
    storyId?: string;
    botId: string;
    type: StoryType;
    channelId: string;
    businessConnectionId: string;
    mediaKind: StoryMediaKind;
    mediaUrl: string;
    mediaSabFileId: string;
    caption: string;
    parseMode: string;
    areas: AreaDraft[];
    privacyKind: StoryPrivacyKind;
    userIdsRaw: string;
    activePeriod: StoryActivePeriodSeconds;
    postToChatPage: boolean;
    protectContent: boolean;
    scheduleMode: 'now' | 'later';
    scheduledDate?: Date;
    scheduledTime: string;
}

export const EMPTY_FORM: FormState = {
    botId: '',
    type: 'channel',
    channelId: '',
    businessConnectionId: '',
    mediaKind: 'photo',
    mediaUrl: '',
    mediaSabFileId: '',
    caption: '',
    parseMode: '',
    areas: [],
    privacyKind: 'public',
    userIdsRaw: '',
    activePeriod: 86400,
    postToChatPage: false,
    protectContent: false,
    scheduleMode: 'now',
    scheduledDate: undefined,
    scheduledTime: '12:00',
};

const PRIVACY_OPTIONS: { value: StoryPrivacyKind; label: string }[] = [
    { value: 'public', label: 'Everyone' },
    { value: 'contacts', label: 'Contacts' },
    { value: 'close_friends', label: 'Close friends' },
    { value: 'selected', label: 'Selected users' },
];

const PERIOD_OPTIONS: { value: StoryActivePeriodSeconds; label: string }[] = [
    { value: 21600, label: '6 hours' },
    { value: 43200, label: '12 hours' },
    { value: 86400, label: '24 hours' },
    { value: 172800, label: '48 hours' },
];

export function makeAreaKey(): string {
    return `area-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function combineDateTime(date: Date | undefined, time: string): Date | null {
    if (!date) return null;
    const [hh, mm] = time.split(':').map((x) => Number(x));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    const d = new Date(date);
    d.setHours(hh, mm, 0, 0);
    return d;
}

export function parseUserIds(raw: string): number[] {
    return raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n > 0);
}

function Section({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="flex flex-col gap-3">
            <div>
                <h3 className="text-[14px] font-medium text-[var(--st-text)]">
                    {title}
                </h3>
                {description ? (
                    <p className="mt-0.5 text-[12px] text-[var(--st-text-secondary)]">
                        {description}
                    </p>
                ) : null}
            </div>
            <div>{children}</div>
        </section>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                {label}
            </span>
            {children}
        </label>
    );
}

export function StoryEditorDrawer({
    open,
    onOpenChange,
    editorForm,
    setEditorForm,
    editorErr,
    savingEditor,
    bots,
    channels,
    businessConnections,
    onSave,
    onCancel,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editorForm: FormState;
    setEditorForm: React.Dispatch<React.SetStateAction<FormState>>;
    editorErr: string | null;
    savingEditor: boolean;
    bots: BotRow[];
    channels: ChannelRow[];
    businessConnections: BusinessConnectionRow[];
    onSave: () => void;
    onCancel: () => void;
}) {
    return (
        <ZoruDrawer open={open} onOpenChange={onOpenChange}>
            <ZoruDrawerContent className="max-h-[92vh] overflow-y-auto">
                <ZoruDrawerHeader>
                    <ZoruDrawerTitle>
                        {editorForm.storyId ? 'Edit story' : 'New story'}
                    </ZoruDrawerTitle>
                    <ZoruDrawerDescription>
                        Stories last 6–48 hours on Telegram. Use 24h unless
                        you have a reason to do otherwise.
                    </ZoruDrawerDescription>
                </ZoruDrawerHeader>
                <div className="grid gap-6 px-6 pb-2">
                    {/* 1. Basics */}
                    <Section
                        title="1. Basics"
                        description="Pick the bot and where this story should appear."
                    >
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Bot">
                                <Select
                                    value={editorForm.botId}
                                    onValueChange={(v) =>
                                        setEditorForm((f) => ({
                                            ...f,
                                            botId: v,
                                        }))
                                    }
                                    disabled={!!editorForm.storyId}
                                >
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue placeholder="Choose a bot" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {bots.map((b) => (
                                            <ZoruSelectItem
                                                key={b._id}
                                                value={b._id}
                                            >
                                                {b.username || b.name}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </Select>
                            </Field>
                            <Field label="Story type">
                                <Select
                                    value={editorForm.type}
                                    onValueChange={(v) =>
                                        setEditorForm((f) => ({
                                            ...f,
                                            type: v as StoryType,
                                        }))
                                    }
                                    disabled={!!editorForm.storyId}
                                >
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="channel">
                                            Channel
                                        </ZoruSelectItem>
                                        <ZoruSelectItem value="business">
                                            Business account
                                        </ZoruSelectItem>
                                    </ZoruSelectContent>
                                </Select>
                            </Field>
                            {editorForm.type === 'channel' ? (
                                <div className="sm:col-span-2">
                                    <Field label="Channel">
                                        <Select
                                            value={editorForm.channelId}
                                            onValueChange={(v) =>
                                                setEditorForm((f) => ({
                                                    ...f,
                                                    channelId: v,
                                                }))
                                            }
                                            disabled={!!editorForm.storyId}
                                        >
                                            <ZoruSelectTrigger>
                                                <ZoruSelectValue placeholder="Pick a channel" />
                                            </ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                {channels.length === 0 ? (
                                                    <div className="px-3 py-2 text-[12px] text-[var(--st-text-secondary)]">
                                                        No channels —
                                                        connect a channel
                                                        first in
                                                        /dashboard/telegram/channels.
                                                    </div>
                                                ) : (
                                                    channels
                                                        .filter(
                                                            (c) =>
                                                                !editorForm.botId ||
                                                                c.botId ===
                                                                    editorForm.botId,
                                                        )
                                                        .map((c) => (
                                                            <ZoruSelectItem
                                                                key={c._id}
                                                                value={c._id}
                                                            >
                                                                {c.title} ({c.chatId})
                                                            </ZoruSelectItem>
                                                        ))
                                                )}
                                            </ZoruSelectContent>
                                        </Select>
                                    </Field>
                                </div>
                            ) : (
                                <div className="sm:col-span-2">
                                    <Field label="Business connection">
                                        <Select
                                            value={
                                                editorForm.businessConnectionId
                                            }
                                            onValueChange={(v) =>
                                                setEditorForm((f) => ({
                                                    ...f,
                                                    businessConnectionId: v,
                                                }))
                                            }
                                            disabled={!!editorForm.storyId}
                                        >
                                            <ZoruSelectTrigger>
                                                <ZoruSelectValue placeholder="Pick a connection" />
                                            </ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                {businessConnections
                                                    .filter(
                                                        (c) =>
                                                            !editorForm.botId ||
                                                            c.botId ===
                                                                editorForm.botId,
                                                    )
                                                    .map((c) => (
                                                        <ZoruSelectItem
                                                            key={c._id}
                                                            value={
                                                                c.connectionId
                                                            }
                                                        >
                                                            {c.connectionId}
                                                            {c.userId
                                                                ? ` (user ${c.userId})`
                                                                : ''}
                                                        </ZoruSelectItem>
                                                    ))}
                                            </ZoruSelectContent>
                                        </Select>
                                    </Field>
                                </div>
                            )}
                        </div>
                    </Section>

                    <Separator />

                    {/* 2. Content */}
                    <Section
                        title="2. Content"
                        description="Media + caption. Media is picked from your SabFiles library."
                    >
                        <div className="grid gap-3">
                            <Field label="Media kind">
                                <RadioGroup
                                    value={editorForm.mediaKind}
                                    onValueChange={(v) =>
                                        setEditorForm((f) => ({
                                            ...f,
                                            mediaKind: v as StoryMediaKind,
                                            mediaUrl: '',
                                            mediaSabFileId: '',
                                        }))
                                    }
                                    className="flex gap-3"
                                >
                                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--st-border)] px-3 py-2 text-sm">
                                        <ZoruRadioGroupItem value="photo" />
                                        <ImageIcon className="h-3.5 w-3.5" />
                                        Photo
                                    </label>
                                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--st-border)] px-3 py-2 text-sm">
                                        <ZoruRadioGroupItem value="video" />
                                        <VideoIcon className="h-3.5 w-3.5" />
                                        Video
                                    </label>
                                </RadioGroup>
                            </Field>

                            <Field
                                label={
                                    editorForm.mediaKind === 'photo'
                                        ? 'Photo from SabFiles'
                                        : 'Video from SabFiles'
                                }
                            >
                                <SabFileUrlInput
                                    value={editorForm.mediaUrl}
                                    onChange={(value, pick) => {
                                        setEditorForm((f) => ({
                                            ...f,
                                            mediaUrl: value,
                                            mediaSabFileId: pick?.id ?? f.mediaSabFileId,
                                        }));
                                    }}
                                    accept={
                                        editorForm.mediaKind === 'photo'
                                            ? 'image'
                                            : 'video'
                                    }
                                    pickerTitle="Pick story media"
                                />
                                {!editorForm.mediaSabFileId && (
                                    <span className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
                                        Telegram fetches the file directly,
                                        so it must be in your library.
                                    </span>
                                )}
                            </Field>

                            <Field label="Caption">
                                <Textarea
                                    rows={3}
                                    value={editorForm.caption}
                                    onChange={(e) =>
                                        setEditorForm((f) => ({
                                            ...f,
                                            caption: e.target.value,
                                        }))
                                    }
                                    placeholder="Story caption — optional"
                                />
                            </Field>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Parse mode">
                                    <Select
                                        value={editorForm.parseMode || 'none'}
                                        onValueChange={(v) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                parseMode:
                                                    v === 'none' ? '' : v,
                                            }))
                                        }
                                    >
                                        <ZoruSelectTrigger>
                                            <ZoruSelectValue />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            <ZoruSelectItem value="none">
                                                None
                                            </ZoruSelectItem>
                                            <ZoruSelectItem value="HTML">
                                                HTML
                                            </ZoruSelectItem>
                                            <ZoruSelectItem value="MarkdownV2">
                                                MarkdownV2
                                            </ZoruSelectItem>
                                            <ZoruSelectItem value="Markdown">
                                                Markdown (legacy)
                                            </ZoruSelectItem>
                                        </ZoruSelectContent>
                                    </Select>
                                </Field>
                            </div>

                            {/* Areas builder */}
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <Label className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                                        Interactive areas
                                    </Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                areas: [
                                                    ...f.areas,
                                                    {
                                                        _key: makeAreaKey(),
                                                        type:
                                                            'suggested_reaction',
                                                        position: {
                                                            x_percentage: 50,
                                                            y_percentage: 50,
                                                            width_percentage: 20,
                                                            height_percentage: 20,
                                                            rotation_angle: 0,
                                                        },
                                                        payload: {},
                                                    },
                                                ],
                                            }))
                                        }
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add area
                                    </Button>
                                </div>
                                {editorForm.areas.length === 0 ? (
                                    <p className="text-[12px] text-[var(--st-text-secondary)]">
                                        None. Areas can layer
                                        reactions, locations, links, or
                                        unique gifts on top of the media.
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {editorForm.areas.map((a, idx) => (
                                            <AreaEditor
                                                key={a._key}
                                                area={a}
                                                onChange={(next) =>
                                                    setEditorForm((f) => {
                                                        const areas = [
                                                            ...f.areas,
                                                        ];
                                                        areas[idx] = next;
                                                        return {
                                                            ...f,
                                                            areas,
                                                        };
                                                    })
                                                }
                                                onRemove={() =>
                                                    setEditorForm((f) => ({
                                                        ...f,
                                                        areas: f.areas.filter(
                                                            (_, i) =>
                                                                i !== idx,
                                                        ),
                                                    }))
                                                }
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Section>

                    <Separator />

                    {/* 3. Privacy */}
                    <Section
                        title="3. Privacy"
                        description="Who can see this story."
                    >
                        <div className="grid gap-3">
                            <Field label="Audience">
                                <Select
                                    value={editorForm.privacyKind}
                                    onValueChange={(v) =>
                                        setEditorForm((f) => ({
                                            ...f,
                                            privacyKind:
                                                v as StoryPrivacyKind,
                                        }))
                                    }
                                >
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {PRIVACY_OPTIONS.map((o) => (
                                            <ZoruSelectItem
                                                key={o.value}
                                                value={o.value}
                                            >
                                                {o.label}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </Select>
                            </Field>
                            {editorForm.privacyKind === 'selected' ? (
                                <Field label="User ids (max 200)">
                                    <Textarea
                                        rows={3}
                                        value={editorForm.userIdsRaw}
                                        onChange={(e) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                userIdsRaw: e.target.value,
                                            }))
                                        }
                                        placeholder="1234567, 9876543"
                                    />
                                    <span className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]">
                                        Comma- or whitespace-separated
                                        numeric Telegram user ids.
                                    </span>
                                </Field>
                            ) : null}
                        </div>
                    </Section>

                    <Separator />

                    {/* 4. Options */}
                    <Section
                        title="4. Options"
                        description="How long the story stays live and whether to pin it to the chat page."
                    >
                        <div className="grid gap-3">
                            <Field label="Active period">
                                <div className="flex flex-wrap gap-2">
                                    {PERIOD_OPTIONS.map((p) => {
                                        const active =
                                            editorForm.activePeriod ===
                                            p.value;
                                        return (
                                            <button
                                                type="button"
                                                key={p.value}
                                                onClick={() =>
                                                    setEditorForm((f) => ({
                                                        ...f,
                                                        activePeriod: p.value,
                                                    }))
                                                }
                                                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                                                    active
                                                        ? 'border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-text-inverted)]'
                                                        : 'border-[var(--st-border)] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]'
                                                }`}
                                            >
                                                {p.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </Field>
                            <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] p-3">
                                <div>
                                    <p className="text-sm text-[var(--st-text)]">
                                        Pin to chat page
                                    </p>
                                    <p className="text-[12px] text-[var(--st-text-secondary)]">
                                        Story stays on the chat page after
                                        it expires from the story feed.
                                    </p>
                                </div>
                                <Switch
                                    checked={editorForm.postToChatPage}
                                    onCheckedChange={(v) =>
                                        setEditorForm((f) => ({
                                            ...f,
                                            postToChatPage: v,
                                        }))
                                    }
                                />
                            </div>
                            <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] p-3">
                                <div>
                                    <p className="text-sm text-[var(--st-text)]">
                                        Protect content
                                    </p>
                                    <p className="text-[12px] text-[var(--st-text-secondary)]">
                                        Disable forwarding and saving.
                                    </p>
                                </div>
                                <Switch
                                    checked={editorForm.protectContent}
                                    onCheckedChange={(v) =>
                                        setEditorForm((f) => ({
                                            ...f,
                                            protectContent: v,
                                        }))
                                    }
                                />
                            </div>
                        </div>
                    </Section>

                    <Separator />

                    {/* 5. Schedule */}
                    <Section
                        title="5. Schedule"
                        description="Post immediately on save, or pick a future time."
                    >
                        <RadioGroup
                            value={editorForm.scheduleMode}
                            onValueChange={(v) =>
                                setEditorForm((f) => ({
                                    ...f,
                                    scheduleMode: v as 'now' | 'later',
                                }))
                            }
                            className="flex gap-3"
                        >
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--st-border)] px-3 py-2 text-sm">
                                <ZoruRadioGroupItem value="now" />
                                Save as draft / Post now
                            </label>
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--st-border)] px-3 py-2 text-sm">
                                <ZoruRadioGroupItem value="later" />
                                Schedule for later
                            </label>
                        </RadioGroup>
                        {editorForm.scheduleMode === 'later' ? (
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <Field label="Date">
                                    <DatePicker
                                        value={editorForm.scheduledDate}
                                        onChange={(d) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                scheduledDate: d,
                                            }))
                                        }
                                    />
                                </Field>
                                <Field label="Time (24h)">
                                    <Input
                                        type="time"
                                        value={editorForm.scheduledTime}
                                        onChange={(e) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                scheduledTime: e.target.value,
                                            }))
                                        }
                                    />
                                </Field>
                            </div>
                        ) : null}
                    </Section>

                    {editorErr ? (
                        <p className="rounded-md border border-zoru-danger-line/50 bg-zoru-danger-surface px-3 py-2 text-[12.5px] text-[var(--st-danger)]">
                            {editorErr}
                        </p>
                    ) : null}
                </div>
                <div className="flex justify-end gap-2 px-6 pb-6 pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onCancel}
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={onSave}
                        disabled={savingEditor}
                    >
                        {savingEditor ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {editorForm.storyId ? 'Save changes' : 'Create'}
                    </Button>
                </div>
            </ZoruDrawerContent>
        </ZoruDrawer>
    );
}
