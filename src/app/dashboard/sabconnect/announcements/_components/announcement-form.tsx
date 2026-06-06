'use client';

import {
    Badge,
    Button,
    Card,
    CardBody,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    Field,
    Input,
    Switch,
    Tag,
    Textarea,
    useToast,
} from '@/components/sabcrm/20ui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityFormField } from '@/components/crm/entity-form-field';
import {
    useActionState,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Paperclip,
    Plus,
    Save,
    Upload,
    X,
} from 'lucide-react';

/**
 * Announcement form (§1B W7, deepened §3.3.2), shared by /new and /[id]/edit.
 *
 * Deepening additions on top of the original sectioned form:
 *  - Targeting picker (departments) with chip list. Augments the legacy
 *    free-text `audienceIds` comma-separated input by writing the same
 *    field name, so the existing server action is unchanged.
 *  - Multi-file attachment list via SabFilePickerButton (in addition to
 *    the banner image), JSON-encoded into a hidden `attachments` field.
 *  - Reorganised into Card sections (Content, Schedule, Targeting,
 *    Behaviour, Attachments).
 *  - Falls back to Textarea for the body. There is no shared rich
 *    text editor in the repo today (see report; only Meta-Flow's
 *    in-canvas RichText component exists, which is not reusable here).
 *
 * Note: 20ui Switch is a button[role="switch"] and does not post a form
 * value, so each toggle is controlled and mirrored into a hidden input so
 * the server action still receives pinned / allowComments / requireAck.
 */

import * as React from 'react';

import { SabFilePickerButton } from '@/components/sabfiles';

import { saveAnnouncement } from '@/app/actions/crm-announcements.actions';
import type { CrmAnnouncementDoc } from '@/lib/rust-client/crm-announcements';

const BASE = '/dashboard/sabconnect/announcements';

interface DeptChip {
    id: string;
    name: string;
}

interface AttachmentRow {
    id: string;
    url: string;
    name: string;
    mime?: string;
    size?: number;
}

export interface AnnouncementFormProps {
    mode: 'new' | 'edit';
    announcement?: CrmAnnouncementDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const INITIAL_STATE: SaveState = { message: '', error: '' };

function parseInitialDepartments(
    announcement?: CrmAnnouncementDoc | null,
): DeptChip[] {
    const ids = announcement?.audienceIds ?? [];
    return ids.map((id) => ({ id, name: '' }));
}

export function AnnouncementForm({
    mode,
    announcement,
}: AnnouncementFormProps): React.JSX.Element {
    const router = useRouter();
    const { toast } = useToast();
    const [state, formAction] = useActionState(
        saveAnnouncement,
        INITIAL_STATE as SaveState,
    );

    const [bannerUrl, setBannerUrl] = useState<string>(
        announcement?.bannerUrl ?? '',
    );
    const [bannerName, setBannerName] = useState<string>('');
    const [audienceMode, setAudienceMode] = useState<string>(
        announcement?.audience ?? 'all',
    );
    const [departments, setDepartments] = useState<DeptChip[]>(
        parseInitialDepartments(announcement),
    );
    const [pendingDeptId, setPendingDeptId] = useState<string>('');
    const [pendingDeptName, setPendingDeptName] = useState<string>('');
    const [attachments, setAttachments] = useState<AttachmentRow[]>(() => {
        const raw = (
            announcement as unknown as { attachments?: AttachmentRow[] } | null
        )?.attachments;
        return Array.isArray(raw) ? raw : [];
    });

    const [pinned, setPinned] = useState<boolean>(!!announcement?.pinned);
    const [allowComments, setAllowComments] = useState<boolean>(
        !!announcement?.allowComments,
    );
    const [requireAcknowledgement, setRequireAcknowledgement] =
        useState<boolean>(!!announcement?.requireAcknowledgement);

    const audienceIdsCsv = useMemo(
        () => departments.map((d) => d.id).join(', '),
        [departments],
    );

    const attachmentsJson = useMemo(
        () => JSON.stringify(attachments),
        [attachments],
    );

    useEffect(() => {
        if (state?.message) {
            toast.success({ title: 'Saved', description: state.message });
            const target = state.id ? `${BASE}/${state.id}` : BASE;
            router.push(target);
        }
        if (state?.error) {
            toast.error({
                title: 'Save failed',
                description: state.error,
            });
        }
    }, [state, toast, router]);

    const addDepartment = () => {
        if (!pendingDeptId) return;
        if (departments.some((d) => d.id === pendingDeptId)) return;
        setDepartments((prev) => [
            ...prev,
            { id: pendingDeptId, name: pendingDeptName },
        ]);
        setPendingDeptId('');
        setPendingDeptName('');
    };

    const removeDepartment = (id: string) =>
        setDepartments((prev) => prev.filter((d) => d.id !== id));

    const removeAttachment = (id: string) =>
        setAttachments((prev) => prev.filter((a) => a.id !== id));

    const initialTags = (announcement?.tags ?? []).join(', ');
    const initialPublishAt = announcement?.publishAt
        ? announcement.publishAt.slice(0, 16)
        : '';
    const initialExpiresAt = announcement?.expiresAt
        ? announcement.expiresAt.slice(0, 16)
        : '';

    const hasStats =
        announcement?.viewCount != null ||
        announcement?.acknowledgementCount != null;

    return (
        <form action={formAction} className="flex w-full flex-col gap-5">
            {announcement?._id ? (
                <input
                    type="hidden"
                    name="announcementId"
                    value={announcement._id}
                />
            ) : null}
            <input type="hidden" name="bannerUrl" value={bannerUrl} />
            <input type="hidden" name="audienceIds" value={audienceIdsCsv} />
            <input type="hidden" name="attachments" value={attachmentsJson} />
            <input
                type="hidden"
                name="pinned"
                value={pinned ? 'true' : ''}
            />
            <input
                type="hidden"
                name="allowComments"
                value={allowComments ? 'true' : ''}
            />
            <input
                type="hidden"
                name="requireAcknowledgement"
                value={requireAcknowledgement ? 'true' : ''}
            />

            {/* Content */}
            <Card padding="none">
                <CardHeader>
                    <CardTitle>Content</CardTitle>
                    <CardDescription>
                        Title and body. Markdown supported in the body.
                    </CardDescription>
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                    <Field label="Title" required>
                        <Input
                            name="title"
                            required
                            minLength={3}
                            defaultValue={announcement?.title ?? ''}
                            placeholder="e.g. Q3 roadmap update"
                        />
                    </Field>
                    <Field
                        label="Body"
                        required
                        help="No shared rich-text editor in the repo today. Markdown is rendered on the detail page."
                    >
                        <Textarea
                            name="body"
                            rows={10}
                            required
                            minLength={1}
                            defaultValue={announcement?.body ?? ''}
                            className="font-mono text-[12.5px]"
                            placeholder="Markdown or plain text"
                        />
                    </Field>
                    <Field label="Banner image">
                        <div className="flex items-center gap-2">
                            <SabFilePickerButton
                                accept="image"
                                title="Pick a banner image"
                                onPick={({ url, name }) => {
                                    setBannerUrl(url);
                                    setBannerName(name ?? '');
                                }}
                            >
                                <Upload className="h-4 w-4" />
                                {bannerUrl ? 'Replace banner' : 'Add banner'}
                            </SabFilePickerButton>
                            {bannerUrl ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setBannerUrl('');
                                        setBannerName('');
                                    }}
                                >
                                    Remove
                                </Button>
                            ) : null}
                        </div>
                        {bannerUrl ? (
                            <div className="mt-2 truncate rounded-[var(--st-radius)] border border-[var(--st-border)] px-2 py-1.5 text-[12px] text-[var(--st-text)]">
                                {bannerName || bannerUrl}
                            </div>
                        ) : null}
                    </Field>
                </CardBody>
            </Card>

            {/* Scheduling */}
            <Card padding="none">
                <CardHeader>
                    <CardTitle>Schedule</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Publish at">
                            <Input
                                name="publishAt"
                                type="datetime-local"
                                defaultValue={initialPublishAt}
                            />
                        </Field>
                        <Field label="Expires at">
                            <Input
                                name="expiresAt"
                                type="datetime-local"
                                defaultValue={initialExpiresAt}
                            />
                        </Field>
                    </div>
                </CardBody>
            </Card>

            {/* Targeting */}
            <Card padding="none">
                <CardHeader>
                    <CardTitle>Audience</CardTitle>
                    <CardDescription>
                        Choose who sees the announcement.
                    </CardDescription>
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Audience">
                            <EnumFormField
                                enumName="announcementAudience"
                                name="audience"
                                initialId={audienceMode}
                                onChange={(value) =>
                                    setAudienceMode(value as string)
                                }
                            />
                        </Field>
                    </div>
                    {audienceMode !== 'all' ? (
                        <Field
                            label="Target departments / teams"
                            help="Pick the recipients of this announcement."
                        >
                            <div className="flex flex-wrap items-end gap-2">
                                <div className="min-w-[260px] flex-1">
                                    <EntityFormField
                                        entity="department"
                                        name="__pendingDept"
                                        initialId={pendingDeptId || null}
                                        initialLabel={pendingDeptName}
                                        placeholder="Pick department"
                                        onChange={(id, hydrated) => {
                                            setPendingDeptId(id ?? '');
                                            setPendingDeptName(
                                                hydrated?.chip.primary ?? '',
                                            );
                                        }}
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    iconLeft={Plus}
                                    onClick={addDepartment}
                                    disabled={!pendingDeptId}
                                >
                                    Add
                                </Button>
                            </div>
                            {departments.length > 0 ? (
                                <ul className="mt-2 flex flex-wrap gap-1.5">
                                    {departments.map((d) => (
                                        <li key={d.id}>
                                            <Tag
                                                onRemove={() =>
                                                    removeDepartment(d.id)
                                                }
                                                removeLabel={`Remove ${d.name || d.id}`}
                                            >
                                                {d.name || d.id}
                                            </Tag>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </Field>
                    ) : null}
                </CardBody>
            </Card>

            {/* Behaviour */}
            <Card padding="none">
                <CardHeader>
                    <CardTitle>Status, category &amp; behaviour</CardTitle>
                </CardHeader>
                <CardBody>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Field label="Status">
                            <EnumFormField
                                enumName="announcementStatus"
                                name="status"
                                initialId={announcement?.status ?? 'draft'}
                            />
                        </Field>
                        <Field label="Category">
                            <EnumFormField
                                enumName="announcementCategory"
                                name="category"
                                initialId={
                                    (announcement?.category as string) ??
                                    'general'
                                }
                            />
                        </Field>
                        <Field label="Priority">
                            <EnumFormField
                                enumName="priority"
                                name="priority"
                                initialId={
                                    (announcement?.priority as string) ??
                                    'normal'
                                }
                            />
                        </Field>
                        <div className="md:col-span-2">
                            <Field label="Tags">
                                <Input
                                    name="tags"
                                    defaultValue={initialTags}
                                    placeholder="comma, separated, tags"
                                />
                            </Field>
                        </div>
                        <div className="flex flex-col gap-3 pt-2">
                            <Switch
                                checked={pinned}
                                onCheckedChange={setPinned}
                                label="Pinned"
                            />
                            <Switch
                                checked={allowComments}
                                onCheckedChange={setAllowComments}
                                label="Allow comments"
                            />
                            <Switch
                                checked={requireAcknowledgement}
                                onCheckedChange={setRequireAcknowledgement}
                                label="Require ack"
                            />
                        </div>
                        {hasStats ? (
                            <div className="md:col-span-3">
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <Badge tone="neutral">
                                        {announcement?.viewCount ?? 0} views
                                    </Badge>
                                    <Badge tone="neutral">
                                        {announcement?.acknowledgementCount ?? 0}{' '}
                                        acks
                                    </Badge>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </CardBody>
            </Card>

            {/* Attachments */}
            <Card padding="none">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <div>
                        <CardTitle>Attachments</CardTitle>
                        <CardDescription>
                            Files from your SabFiles library.
                        </CardDescription>
                    </div>
                    <SabFilePickerButton
                        onPick={(pick) => {
                            setAttachments((prev) =>
                                prev.some((a) => a.id === pick.id)
                                    ? prev
                                    : [
                                          ...prev,
                                          {
                                              id: pick.id,
                                              url: pick.url,
                                              name: pick.name,
                                              mime: pick.mime,
                                              size: pick.size,
                                          },
                                      ],
                            );
                        }}
                    >
                        <Paperclip className="h-3.5 w-3.5" /> Add file
                    </SabFilePickerButton>
                </CardHeader>
                <CardBody>
                    {attachments.length === 0 ? (
                        <EmptyState
                            icon={Paperclip}
                            size="sm"
                            title="No attachments yet"
                            description="Add files from your SabFiles library."
                        />
                    ) : (
                        <ul className="flex flex-col gap-1.5">
                            {attachments.map((a) => (
                                <li
                                    key={a.id}
                                    className="flex items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] px-2.5 py-1.5 text-[12.5px]"
                                >
                                    <span className="truncate text-[var(--st-text)]">
                                        {a.name}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        iconLeft={X}
                                        aria-label={`Remove ${a.name}`}
                                        onClick={() => removeAttachment(a.id)}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>

            {state?.error ? (
                <p role="alert" className="text-sm text-[var(--st-danger)]">
                    {state.error}
                </p>
            ) : null}

            {/* Sticky footer */}
            <div className="sticky bottom-0 -mx-4 -mb-4 mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3 md:-mx-6 md:px-6">
                <Button
                    variant="ghost"
                    iconLeft={ArrowLeft}
                    onClick={() => router.push(BASE)}
                >
                    Cancel
                </Button>
                <SubmitButton
                    label={mode === 'edit' ? 'Save changes' : 'Publish'}
                />
            </div>
        </form>
    );
}

function SubmitButton({ label }: { label: string }) {
    const { pending } = useFormStatus();
    return (
        <Button
            type="submit"
            variant="primary"
            iconLeft={Save}
            loading={pending}
            disabled={pending}
        >
            {label}
        </Button>
    );
}

export default AnnouncementForm;
