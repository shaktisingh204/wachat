'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, Input, Label, Separator, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
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

const STATUS_BADGE: Record<KbArticleStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    draft: 'outline',
    published: 'default',
    archived: 'secondary',
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

    // ── Portal handlers ─────────────────────────────────────────────────
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
        if (!confirm('Delete this portal? Articles + categories under it will be orphaned.'))
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

    // ── Category handlers ───────────────────────────────────────────────
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

    // ── Article handlers ────────────────────────────────────────────────
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

    // ── Empty: no portals ──────────────────────────────────────────────
    if (portals.length === 0) {
        return (
            <div className="space-y-4">
                <div className="rounded border border-dashed bg-[var(--st-bg-secondary)] p-6 text-center text-sm text-[var(--st-text-secondary)]">
                    No knowledge portals yet. Create one to start authoring articles.
                </div>
                <PortalForm pending={isPending} onSubmit={onCreatePortal} />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Top toolbar — portal selector + new portal trigger */}
            <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs font-semibold uppercase text-[var(--st-text-secondary)]">
                    Portal
                </Label>
                <Select
                    value={selectedPortalId}
                    onValueChange={(v) => pushQuery({ portalId: v, selected: undefined })}
                >
                    <SelectTrigger className="w-64">
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
                    <Badge variant={selectedPortal.active ? 'default' : 'secondary'}>
                        {selectedPortal.active ? 'active' : 'inactive'}
                    </Badge>
                ) : null}
                <div className="ml-auto flex gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowPortalForm((v) => !v)}
                        disabled={isPending}
                    >
                        {showPortalForm ? 'Cancel' : 'New portal'}
                    </Button>
                    {selectedPortal ? (
                        <Button
                            size="sm"
                            variant="ghost"
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
                    variant={status === undefined ? 'default' : 'outline'}
                    onClick={() => pushQuery({ status: undefined, selected: undefined })}
                >
                    All
                </Button>
                {STATUSES.map((s) => (
                    <Button
                        key={s}
                        size="sm"
                        variant={status === s ? 'default' : 'outline'}
                        className="capitalize"
                        onClick={() => pushQuery({ status: s, selected: undefined })}
                    >
                        {s}
                    </Button>
                ))}
                <form onSubmit={onSearchSubmit} className="ml-auto flex gap-2">
                    <Input
                        placeholder="Search title or body…"
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
                        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                            <CardTitle className="text-sm">Categories</CardTitle>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setShowCategoryForm((v) => !v)}
                                disabled={isPending}
                            >
                                {showCategoryForm ? 'Cancel' : '+ New'}
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
                                <div className="rounded border border-dashed p-3 text-center text-xs text-[var(--st-text-secondary)]">
                                    No categories yet.
                                </div>
                            ) : (
                                <ul className="space-y-1">
                                    {categories.map((c) => (
                                        <li
                                            key={c._id}
                                            className="flex items-center justify-between rounded border bg-[var(--st-bg-secondary)] px-2 py-1 text-xs"
                                        >
                                            <span className="truncate">
                                                {c.name}
                                                <span className="ml-1 text-[var(--st-text-secondary)]">
                                                    /{c.slug}
                                                </span>
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => onDeleteCategory(c._id)}
                                                disabled={isPending}
                                            >
                                                ×
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardBody>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Articles</CardTitle>
                            <CardDescription className="text-xs">
                                {articles.length} result(s)
                            </CardDescription>
                        </CardHeader>
                        <CardBody>
                            {articles.length === 0 ? (
                                <div className="rounded border border-dashed p-4 text-center text-xs text-[var(--st-text-secondary)]">
                                    No articles yet. Use the editor to create one.
                                </div>
                            ) : (
                                <ul className="divide-y">
                                    {articles.map((a) => (
                                        <li
                                            key={a._id}
                                            className={`cursor-pointer rounded px-2 py-2 text-sm hover:bg-[var(--st-bg-muted)] ${
                                                a._id === selectedArticleId ? 'bg-[var(--st-bg-muted)]' : ''
                                            }`}
                                            onClick={() => pushQuery({ selected: a._id })}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate font-medium">
                                                    {a.title}
                                                </span>
                                                <Badge
                                                    variant={STATUS_BADGE[a.status]}
                                                    className="text-[10px] capitalize"
                                                >
                                                    {a.status}
                                                </Badge>
                                            </div>
                                            <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--st-text-secondary)]">
                                                <span className="truncate">/{a.slug}</span>
                                                <span>
                                                    {a.viewCount} views ·{' '}
                                                    {new Date(a.updatedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            {a.tags.length ? (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {a.tags.slice(0, 4).map((t) => (
                                                        <Badge
                                                            key={t}
                                                            variant="outline"
                                                            className="text-[10px]"
                                                        >
                                                            {t}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : null}
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

// ─────────────────────────────────────────────────────────────────────────────
// PortalForm
// ─────────────────────────────────────────────────────────────────────────────

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
                    One portal per brand or product line — articles + categories live inside.
                </CardDescription>
            </CardHeader>
            <CardBody>
                <form
                    action={(fd) => onSubmit(fd)}
                    className="grid grid-cols-1 gap-3 md:grid-cols-2"
                >
                    <div className="space-y-1">
                        <Label htmlFor="portal-name">Name</Label>
                        <Input id="portal-name" name="name" placeholder="Help Center" required />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="portal-slug">Slug</Label>
                        <Input
                            id="portal-slug"
                            name="slug"
                            placeholder="auto-generated from name"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="portal-lang">Default language</Label>
                        <Input id="portal-lang" name="defaultLanguage" defaultValue="en" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="portal-domain">Custom domain (optional)</Label>
                        <Input
                            id="portal-domain"
                            name="customDomain"
                            placeholder="help.example.com"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="portal-color">Theme color (optional)</Label>
                        <Input id="portal-color" name="color" placeholder="#4f46e5" />
                    </div>
                    <div className="flex items-end md:col-span-2">
                        <Button type="submit" disabled={pending}>
                            Create portal
                        </Button>
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CategoryForm
// ─────────────────────────────────────────────────────────────────────────────

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
    return (
        <form
            action={(fd) => onSubmit(fd)}
            className="space-y-2 rounded border bg-[var(--st-bg-secondary)] p-2"
        >
            <input type="hidden" name="portalId" value={portalId} />
            <Input name="name" placeholder="Category name" required className="text-sm" />
            <Input name="slug" placeholder="slug (auto)" className="text-sm" />
            {parents.length ? (
                <select
                    name="parentId"
                    defaultValue=""
                    className="w-full rounded border bg-[var(--st-bg-secondary)] px-2 py-1 text-sm"
                >
                    <option value="">No parent</option>
                    {parents.map((p) => (
                        <option key={p._id} value={p._id}>
                            {p.name}
                        </option>
                    ))}
                </select>
            ) : null}
            <Input
                name="sortOrder"
                type="number"
                defaultValue={0}
                placeholder="Sort order"
                className="text-sm"
            />
            <Button type="submit" size="sm" disabled={pending}>
                Create
            </Button>
        </form>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ArticleEditor — switches between create/edit by presence of `article`
// ─────────────────────────────────────────────────────────────────────────────

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

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <div>
                    <CardTitle className="text-base">
                        {isEdit ? 'Edit article' : 'New article'}
                    </CardTitle>
                    {isEdit && article ? (
                        <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge
                                variant={STATUS_BADGE[article.status]}
                                className="capitalize"
                            >
                                {article.status}
                            </Badge>
                            <span>{article.viewCount} views</span>
                            <span>· {article.helpfulCount} 👍</span>
                            <span>· {article.notHelpfulCount} 👎</span>
                            {article.publishedAt ? (
                                <span>
                                    · published{' '}
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
                            <Button size="sm" variant="ghost" onClick={onNew} disabled={pending}>
                                + New
                            </Button>
                            {article && article.status !== 'published' ? (
                                <Button size="sm" onClick={onPublish} disabled={pending}>
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
                    <div className="md:col-span-2 space-y-1">
                        <Label htmlFor="article-title">Title</Label>
                        <Input
                            id="article-title"
                            name="title"
                            defaultValue={article?.title ?? ''}
                            placeholder="How to reset your password"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="article-slug">Slug</Label>
                        <Input
                            id="article-slug"
                            name="slug"
                            defaultValue={article?.slug ?? ''}
                            placeholder="auto-generated from title"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="article-lang">Language</Label>
                        <Input
                            id="article-lang"
                            name="language"
                            defaultValue={article?.language ?? defaultLanguage}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="article-category">Category</Label>
                        <select
                            id="article-category"
                            name="categoryId"
                            defaultValue={article?.categoryId ?? ''}
                            className="h-9 w-full rounded border bg-[var(--st-bg-secondary)] px-2 text-sm"
                        >
                            <option value="">— None —</option>
                            {categories.map((c) => (
                                <option key={c._id} value={c._id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="article-status">Status</Label>
                        <select
                            id="article-status"
                            name="status"
                            defaultValue={article?.status ?? 'draft'}
                            className="h-9 w-full rounded border bg-[var(--st-bg-secondary)] px-2 text-sm"
                        >
                            {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                        <Label htmlFor="article-tags">Tags (comma-separated)</Label>
                        <Input
                            id="article-tags"
                            name="tags"
                            defaultValue={article?.tags.join(', ') ?? ''}
                            placeholder="billing, account, password"
                        />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                        <Label htmlFor="article-body">Body (markdown)</Label>
                        <Textarea
                            id="article-body"
                            name="body"
                            defaultValue={article?.body ?? ''}
                            rows={16}
                            placeholder="# Heading&#10;&#10;Write the article in markdown…"
                            className="font-mono text-sm"
                        />
                    </div>
                    <div className="md:col-span-2 flex gap-2">
                        <Button type="submit" disabled={pending}>
                            {isEdit ? 'Save changes' : 'Create article'}
                        </Button>
                        {!isEdit ? (
                            <Button
                                type="reset"
                                variant="ghost"
                                disabled={pending}
                            >
                                Clear
                            </Button>
                        ) : null}
                    </div>
                </form>
            </CardBody>
        </Card>
    );
}
