'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Plus, Search, Trash2, X } from 'lucide-react';
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
    IconButton,
    Input,
    Separator,
    Textarea,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/sabcrm/20ui';
import {
    createPortal,
    deletePortal,
    createCategory,
    deleteCategory,
    createArticle,
    updateArticle,
    publishArticle,
    archiveArticle,
    deleteArticle,
} from '@/app/actions/sabchat-knowledge.actions';
import type {
    KbArticle,
    KbArticleStatus,
    KbCategory,
    KbPortal,
} from '@/lib/rust-client/sabchat-knowledge';
import { useToast } from '@/hooks/use-toast';

interface Props {
    portals: KbPortal[];
    selectedPortalId: string;
    status: KbArticleStatus | undefined;
    q: string;
    categories: KbCategory[];
    articles: KbArticle[];
    initialSelectedArticleId?: string;
}

const STATUSES: KbArticleStatus[] = ['draft', 'published', 'archived'];

const STATUS_TONE: Record<KbArticleStatus, 'neutral' | 'success' | 'info'> = {
    draft: 'neutral',
    published: 'success',
    archived: 'info',
};

export function KnowledgeClient({
    portals,
    selectedPortalId,
    status,
    q,
    categories,
    articles,
    initialSelectedArticleId,
}: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const [showPortalForm, setShowPortalForm] = useState(portals.length === 0);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [searchDraft, setSearchDraft] = useState(q);

    const selectedArticleId =
        initialSelectedArticleId ?? articles[0]?._id ?? undefined;
    const selectedArticle = useMemo(
        () => articles.find((a) => a._id === selectedArticleId),
        [articles, selectedArticleId],
    );

    const selectedPortal = useMemo(
        () => portals.find((p) => p._id === selectedPortalId),
        [portals, selectedPortalId],
    );

    function pushQuery(patch: Record<string, string | undefined>) {
        const next = new URLSearchParams(searchParams?.toString() ?? '');
        for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === '') next.delete(k);
            else next.set(k, v);
        }
        const qsStr = next.toString();
        router.replace(qsStr ? `${pathname}?${qsStr}` : pathname);
    }

    // Portal handlers
    function onCreatePortal(formData: FormData) {
        startTransition(async () => {
            const r = await createPortal(formData);
            if (r.error) {
                toast({ title: 'Create portal failed', description: r.error, variant: 'destructive' });
                return;
            }
            toast({ title: r.message ?? 'Created' });
            setShowPortalForm(false);
            if (r.data?._id) pushQuery({ portalId: r.data._id, selected: undefined });
            else router.refresh();
        });
    }

    function onDeletePortal(id: string) {
        if (!confirm('Delete this portal? Articles and categories under it will be orphaned.'))
            return;
        startTransition(async () => {
            const r = await deletePortal(id);
            if (r.error) {
                toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
                return;
            }
            toast({ title: r.message ?? 'Deleted' });
            pushQuery({ portalId: undefined, selected: undefined });
        });
    }

    // Category handlers
    function onCreateCategory(formData: FormData) {
        formData.set('portalId', selectedPortalId);
        startTransition(async () => {
            const r = await createCategory(formData);
            if (r.error) {
                toast({ title: 'Create category failed', description: r.error, variant: 'destructive' });
                return;
            }
            toast({ title: r.message ?? 'Created' });
            setShowCategoryForm(false);
            router.refresh();
        });
    }

    function onDeleteCategory(id: string) {
        if (!confirm('Delete this category?')) return;
        startTransition(async () => {
            const r = await deleteCategory(id);
            if (r.error) {
                toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
                return;
            }
            toast({ title: r.message ?? 'Deleted' });
            router.refresh();
        });
    }

    // Article handlers
    function onCreateArticle(formData: FormData) {
        formData.set('portalId', selectedPortalId);
        startTransition(async () => {
            const r = await createArticle(formData);
            if (r.error) {
                toast({ title: 'Create article failed', description: r.error, variant: 'destructive' });
                return;
            }
            toast({ title: r.message ?? 'Created' });
            if (r.data?._id) pushQuery({ selected: r.data._id });
            else router.refresh();
        });
    }

    function onUpdateArticle(formData: FormData) {
        if (!selectedArticle) return;
        startTransition(async () => {
            const r = await updateArticle(selectedArticle._id, formData);
            if (r.error) {
                toast({ title: 'Update failed', description: r.error, variant: 'destructive' });
                return;
            }
            toast({ title: r.message ?? 'Saved' });
            router.refresh();
        });
    }

    function onPublish() {
        if (!selectedArticle) return;
        startTransition(async () => {
            const r = await publishArticle(selectedArticle._id);
            if (r.error) {
                toast({ title: 'Publish failed', description: r.error, variant: 'destructive' });
                return;
            }
            toast({ title: r.message ?? 'Published' });
            router.refresh();
        });
    }

    function onArchive() {
        if (!selectedArticle) return;
        startTransition(async () => {
            const r = await archiveArticle(selectedArticle._id);
            if (r.error) {
                toast({ title: 'Archive failed', description: r.error, variant: 'destructive' });
                return;
            }
            toast({ title: r.message ?? 'Archived' });
            router.refresh();
        });
    }

    function onDeleteArticle() {
        if (!selectedArticle) return;
        if (!confirm('Delete this article?')) return;
        startTransition(async () => {
            const r = await deleteArticle(selectedArticle._id);
            if (r.error) {
                toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
                return;
            }
            toast({ title: r.message ?? 'Deleted' });
            pushQuery({ selected: undefined });
        });
    }

    function onSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        pushQuery({ q: searchDraft || undefined, selected: undefined });
    }

    // Empty: no portals
    if (portals.length === 0) {
        return (
            <div className="flex flex-col gap-4">
                <EmptyState
                    title="No knowledge portals yet"
                    description="Create one to start authoring articles."
                />
                <PortalForm pending={isPending} onSubmit={onCreatePortal} />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Top toolbar: portal selector + new portal trigger */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase text-[var(--st-text-secondary)]">
                    Portal
                </span>
                <Select
                    value={selectedPortalId}
                    onValueChange={(v) => pushQuery({ portalId: v, selected: undefined })}
                >
                    <SelectTrigger aria-label="Portal" className="w-64">
                        <SelectValue placeholder="Select a portal" />
                    </SelectTrigger>
                    <SelectContent>
                        {portals.map((p) => (
                            <SelectItem key={p._id} value={p._id}>
                                {p.name} ({p.slug})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {selectedPortal ? (
                    <Badge tone={selectedPortal.active ? 'success' : 'neutral'}>
                        {selectedPortal.active ? 'active' : 'inactive'}
                    </Badge>
                ) : null}
                <div className="ml-auto flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        iconLeft={showPortalForm ? undefined : Plus}
                        onClick={() => setShowPortalForm((v) => !v)}
                        disabled={isPending}
                    >
                        {showPortalForm ? 'Cancel' : 'New portal'}
                    </Button>
                    {selectedPortal ? (
                        <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={Trash2}
                            onClick={() => onDeletePortal(selectedPortal._id)}
                            disabled={isPending}
                        >
                            Delete portal
                        </Button>
                    ) : null}
                </div>
            </div>

            {showPortalForm ? (
                <PortalForm pending={isPending} onSubmit={onCreatePortal} />
            ) : null}

            {/* Status chips + search */}
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    size="sm"
                    variant={status === undefined ? 'primary' : 'outline'}
                    onClick={() => pushQuery({ status: undefined, selected: undefined })}
                >
                    All
                </Button>
                {STATUSES.map((s) => (
                    <Button
                        key={s}
                        size="sm"
                        variant={status === s ? 'primary' : 'outline'}
                        className="capitalize"
                        onClick={() => pushQuery({ status: s, selected: undefined })}
                    >
                        {s}
                    </Button>
                ))}
                <form onSubmit={onSearchSubmit} className="ml-auto flex gap-2">
                    <Input
                        aria-label="Search articles"
                        iconLeft={Search}
                        placeholder="Search title or body..."
                        value={searchDraft}
                        onChange={(e) => setSearchDraft(e.target.value)}
                        className="w-64"
                    />
                    <Button size="sm" type="submit" variant="outline" disabled={isPending}>
                        Search
                    </Button>
                </form>
            </div>

            {/* 2-pane: articles list | editor */}
            <div className="grid grid-cols-12 gap-3">
                {/* Articles list + category mini-rail */}
                <section className="col-span-4 flex flex-col gap-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-2">
                            <CardTitle className="text-sm">Categories</CardTitle>
                            <Button
                                size="sm"
                                variant="ghost"
                                iconLeft={showCategoryForm ? undefined : Plus}
                                onClick={() => setShowCategoryForm((v) => !v)}
                                disabled={isPending}
                            >
                                {showCategoryForm ? 'Cancel' : 'New'}
                            </Button>
                        </CardHeader>
                        <CardBody className="space-y-2">
                            {showCategoryForm ? (
                                <CategoryForm
                                    portalId={selectedPortalId}
                                    pending={isPending}
                                    onSubmit={onCreateCategory}
                                    parents={categories}
                                />
                            ) : null}
                            {categories.length === 0 ? (
                                <EmptyState size="sm" title="No categories yet" />
                            ) : (
                                <ul className="space-y-1">
                                    {categories.map((c) => (
                                        <li
                                            key={c._id}
                                            className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-1 text-xs"
                                        >
                                            <span className="truncate">
                                                {c.name}
                                                <span className="ml-1 text-[var(--st-text-secondary)]">
                                                    /{c.slug}
                                                </span>
                                            </span>
                                            <IconButton
                                                label={`Delete category ${c.name}`}
                                                icon={X}
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => onDeleteCategory(c._id)}
                                                disabled={isPending}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardBody>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Articles</CardTitle>
                            <CardDescription className="text-xs">
                                {articles.length} result(s)
                            </CardDescription>
                        </CardHeader>
                        <CardBody>
                            {articles.length === 0 ? (
                                <EmptyState
                                    size="sm"
                                    title="No articles yet"
                                    description="Use the editor to create one."
                                />
                            ) : (
                                <ul className="divide-y divide-[var(--st-border)]">
                                    {articles.map((a) => (
                                        <li key={a._id}>
                                            <Button
                                                variant="ghost"
                                                block
                                                aria-label={`Open article ${a.title}`}
                                                aria-pressed={a._id === selectedArticleId}
                                                onClick={() => pushQuery({ selected: a._id })}
                                                className={`h-auto justify-start rounded-[var(--st-radius)] px-2 py-2 text-left [&_.u-btn__label]:flex [&_.u-btn__label]:w-full [&_.u-btn__label]:flex-col [&_.u-btn__label]:items-stretch [&_.u-btn__label]:gap-1 ${
                                                    a._id === selectedArticleId
                                                        ? 'bg-[var(--st-bg-secondary)]'
                                                        : ''
                                                }`}
                                            >
                                                <span className="flex items-center justify-between gap-2">
                                                    <span className="truncate text-sm font-medium text-[var(--st-text)]">
                                                        {a.title}
                                                    </span>
                                                    <Badge
                                                        tone={STATUS_TONE[a.status]}
                                                        className="capitalize"
                                                    >
                                                        {a.status}
                                                    </Badge>
                                                </span>
                                                <span className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
                                                    <span className="truncate">/{a.slug}</span>
                                                    <span>
                                                        {a.viewCount} views,{' '}
                                                        {new Date(a.updatedAt).toLocaleDateString()}
                                                    </span>
                                                </span>
                                                {a.tags.length ? (
                                                    <span className="flex flex-wrap gap-1">
                                                        {a.tags.slice(0, 4).map((t) => (
                                                            <Badge
                                                                key={t}
                                                                tone="neutral"
                                                                kind="outline"
                                                            >
                                                                {t}
                                                            </Badge>
                                                        ))}
                                                    </span>
                                                ) : null}
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardBody>
                    </Card>
                </section>

                {/* Editor */}
                <section className="col-span-8">
                    <ArticleEditor
                        key={selectedArticle?._id ?? 'new'}
                        portalId={selectedPortalId}
                        article={selectedArticle}
                        categories={categories}
                        defaultLanguage={selectedPortal?.defaultLanguage ?? 'en'}
                        pending={isPending}
                        onCreate={onCreateArticle}
                        onUpdate={onUpdateArticle}
                        onPublish={onPublish}
                        onArchive={onArchive}
                        onDelete={onDeleteArticle}
                        onNew={() => pushQuery({ selected: undefined })}
                    />
                </section>
            </div>
        </div>
    );
}

// PortalForm

function PortalForm({
    pending,
    onSubmit,
}: {
    pending: boolean;
    onSubmit: (fd: FormData) => void;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">New knowledge portal</CardTitle>
                <CardDescription>
                    One portal per brand or product line. Articles and categories live inside.
                </CardDescription>
            </CardHeader>
            <CardBody>
                <form
                    action={(fd) => onSubmit(fd)}
                    className="grid grid-cols-1 gap-3 md:grid-cols-2"
                >
                    <Field label="Name" required>
                        <Input name="name" placeholder="Help Center" required />
                    </Field>
                    <Field label="Slug">
                        <Input name="slug" placeholder="auto-generated from name" />
                    </Field>
                    <Field label="Default language">
                        <Input name="defaultLanguage" defaultValue="en" />
                    </Field>
                    <Field label="Custom domain (optional)">
                        <Input name="customDomain" placeholder="help.example.com" />
                    </Field>
                    <Field label="Theme color (optional)">
                        <Input name="color" placeholder="#4f46e5" />
                    </Field>
                    <div className="flex items-end md:col-span-2">
                        <Button type="submit" variant="primary" disabled={pending}>
                            Create portal
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}

// CategoryForm

function CategoryForm({
    portalId,
    pending,
    onSubmit,
    parents,
}: {
    portalId: string;
    pending: boolean;
    onSubmit: (fd: FormData) => void;
    parents: KbCategory[];
}) {
    const [parentId, setParentId] = useState('');

    return (
        <form
            action={(fd) => onSubmit(fd)}
            className="space-y-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2"
        >
            <input type="hidden" name="portalId" value={portalId} />
            <input type="hidden" name="parentId" value={parentId} />
            <Field label="Name" required>
                <Input name="name" placeholder="Category name" required />
            </Field>
            <Field label="Slug">
                <Input name="slug" placeholder="slug (auto)" />
            </Field>
            {parents.length ? (
                <Field label="Parent">
                    <Select
                        value={parentId || 'none'}
                        onValueChange={(v) => setParentId(v === 'none' ? '' : v)}
                    >
                        <SelectTrigger aria-label="Parent category">
                            <SelectValue placeholder="No parent" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No parent</SelectItem>
                            {parents.map((p) => (
                                <SelectItem key={p._id} value={p._id}>
                                    {p.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            ) : null}
            <Field label="Sort order">
                <Input name="sortOrder" type="number" defaultValue={0} placeholder="Sort order" />
            </Field>
            <Button type="submit" size="sm" variant="primary" disabled={pending}>
                Create
            </Button>
        </form>
    );
}

// ArticleEditor: switches between create/edit by presence of `article`

function ArticleEditor({
    portalId,
    article,
    categories,
    defaultLanguage,
    pending,
    onCreate,
    onUpdate,
    onPublish,
    onArchive,
    onDelete,
    onNew,
}: {
    portalId: string;
    article: KbArticle | undefined;
    categories: KbCategory[];
    defaultLanguage: string;
    pending: boolean;
    onCreate: (fd: FormData) => void;
    onUpdate: (fd: FormData) => void;
    onPublish: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onNew: () => void;
}) {
    const isEdit = !!article;
    const [categoryId, setCategoryId] = useState(article?.categoryId ?? '');
    const [articleStatus, setArticleStatus] = useState<KbArticleStatus>(
        article?.status ?? 'draft',
    );

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                    <CardTitle className="text-base">
                        {isEdit ? 'Edit article' : 'New article'}
                    </CardTitle>
                    {isEdit && article ? (
                        <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge tone={STATUS_TONE[article.status]} className="capitalize">
                                {article.status}
                            </Badge>
                            <span>{article.viewCount} views</span>
                            <span>, {article.helpfulCount} helpful</span>
                            <span>, {article.notHelpfulCount} not helpful</span>
                            {article.publishedAt ? (
                                <span>
                                    , published{' '}
                                    {new Date(article.publishedAt).toLocaleDateString()}
                                </span>
                            ) : null}
                        </CardDescription>
                    ) : (
                        <CardDescription className="text-xs">
                            Markdown supported. Saves as draft unless you change status.
                        </CardDescription>
                    )}
                </div>
                <div className="flex flex-wrap gap-1">
                    {isEdit ? (
                        <>
                            <Button
                                size="sm"
                                variant="ghost"
                                iconLeft={Plus}
                                onClick={onNew}
                                disabled={pending}
                            >
                                New
                            </Button>
                            {article && article.status !== 'published' ? (
                                <Button size="sm" variant="primary" onClick={onPublish} disabled={pending}>
                                    Publish
                                </Button>
                            ) : null}
                            {article && article.status !== 'archived' ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={onArchive}
                                    disabled={pending}
                                >
                                    Archive
                                </Button>
                            ) : null}
                            <Button
                                size="sm"
                                variant="ghost"
                                iconLeft={Trash2}
                                onClick={onDelete}
                                disabled={pending}
                            >
                                Delete
                            </Button>
                        </>
                    ) : null}
                </div>
            </CardHeader>
            <Separator />
            <CardBody>
                <form
                    action={(fd) => (isEdit ? onUpdate(fd) : onCreate(fd))}
                    className="grid grid-cols-1 gap-3 md:grid-cols-2"
                >
                    <input type="hidden" name="portalId" value={portalId} />
                    <input type="hidden" name="categoryId" value={categoryId} />
                    <input type="hidden" name="status" value={articleStatus} />
                    <Field label="Title" required className="md:col-span-2">
                        <Input
                            name="title"
                            defaultValue={article?.title ?? ''}
                            placeholder="How to reset your password"
                            required
                        />
                    </Field>
                    <Field label="Slug">
                        <Input
                            name="slug"
                            defaultValue={article?.slug ?? ''}
                            placeholder="auto-generated from title"
                        />
                    </Field>
                    <Field label="Language">
                        <Input
                            name="language"
                            defaultValue={article?.language ?? defaultLanguage}
                        />
                    </Field>
                    <Field label="Category">
                        <Select
                            value={categoryId || 'none'}
                            onValueChange={(v) => setCategoryId(v === 'none' ? '' : v)}
                        >
                            <SelectTrigger aria-label="Category">
                                <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {categories.map((c) => (
                                    <SelectItem key={c._id} value={c._id}>
                                        {c.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Status">
                        <Select
                            value={articleStatus}
                            onValueChange={(v) => setArticleStatus(v as KbArticleStatus)}
                        >
                            <SelectTrigger aria-label="Status" className="capitalize">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUSES.map((s) => (
                                    <SelectItem key={s} value={s} className="capitalize">
                                        {s}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="Tags (comma-separated)" className="md:col-span-2">
                        <Input
                            name="tags"
                            defaultValue={article?.tags.join(', ') ?? ''}
                            placeholder="billing, account, password"
                        />
                    </Field>
                    <Field label="Body (markdown)" className="md:col-span-2">
                        <Textarea
                            name="body"
                            defaultValue={article?.body ?? ''}
                            rows={16}
                            placeholder="# Heading&#10;&#10;Write the article in markdown..."
                            className="font-mono text-sm"
                        />
                    </Field>
                    <div className="md:col-span-2 flex gap-2">
                        <Button type="submit" variant="primary" disabled={pending}>
                            {isEdit ? 'Save changes' : 'Create article'}
                        </Button>
                        {!isEdit ? (
                            <Button type="reset" variant="ghost" disabled={pending}>
                                Clear
                            </Button>
                        ) : null}
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}
