'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Pin,
  FileText,
  Video,
  Music,
  Image as ImageIcon,
  File as FileIcon,
  LoaderCircle,
  Folder,
  CheckSquare,
} from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { useToast } from '@/hooks/use-toast';
import {
  getKnowledgeBases,
  getKnowledgeBaseCategories,
  togglePinKnowledgeBase,
  deleteKnowledgeBase,
} from '@/app/actions/worksuite/knowledge.actions';
import type {
  WsKnowledgeBase,
  WsKnowledgeBaseCategory,
  WsKnowledgeBaseType,
} from '@/lib/worksuite/knowledge-types';

const typeIcon: Record<WsKnowledgeBaseType, React.ElementType> = {
  article: FileText,
  video: Video,
  audio: Music,
  image: ImageIcon,
  document: FileIcon,
};

export default function KnowledgeBasePage() {
  const { toast } = useToast();
  const [articles, setArticles] = React.useState<
    (WsKnowledgeBase & { _id: string })[]
  >([]);
  const [categories, setCategories] = React.useState<
    (WsKnowledgeBaseCategory & { _id: string })[]
  >([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [a, c] = await Promise.all([
        getKnowledgeBases(),
        getKnowledgeBaseCategories(),
      ]);
      setArticles(a as any);
      setCategories(c as any);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to load', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, (WsKnowledgeBase & { _id: string })[]>();
    for (const a of articles) {
      const key = a.category_id || '__uncat';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [articles]);

  const handlePin = async (id: string) => {
    const r = await togglePinKnowledgeBase(id);
    if (r.success) refresh();
    else toast({ title: 'Error', description: r.error, variant: 'destructive' });
  };

  const handleDelete = async (id: string) => {
    const r = await deleteKnowledgeBase(id);
    if (r.success) {
      toast({ title: 'Deleted', description: 'Article removed.' });
      refresh();
    } else toast({ title: 'Error', description: r.error, variant: 'destructive' });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Knowledge Base"
        subtitle="Articles, guides, and resources grouped by category."
        icon={BookOpen}
        actions={
          <>
            <Link href="/dashboard/crm/workspace/knowledge-base/categories">
              <ClayButton variant="pill" leading={<Folder className="h-4 w-4" strokeWidth={1.75} />}>
                Categories
              </ClayButton>
            </Link>
            <Link href="/dashboard/crm/workspace/knowledge-base/new">
              <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                New Article
              </ClayButton>
            </Link>
          </>
        }
      />

      {loading ? (
        <ClayCard className="flex items-center justify-center py-10">
          <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
        </ClayCard>
      ) : articles.length === 0 ? (
        <ClayCard>
          <p className="text-center text-[13px] text-muted-foreground">
            No articles yet — click New Article to get started.
          </p>
        </ClayCard>
      ) : (
        <div className="flex flex-col gap-4">
          {[...grouped.entries()].map(([catId, items]) => {
            const cat = categories.find((c) => c._id === catId);
            return (
              <ClayCard key={catId}>
                <div className="mb-3 flex items-center gap-2">
                  <Folder className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                  <h3 className="text-[14px] font-semibold text-foreground">
                    {cat?.name || 'Uncategorized'}
                  </h3>
                  <ClayBadge tone="neutral">{items.length}</ClayBadge>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((a) => {
                    const Icon = typeIcon[a.type] || FileText;
                    return (
                      <ClayCard key={a._id} variant="soft" className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/dashboard/crm/workspace/knowledge-base/${a._id}`}
                            className="flex items-start gap-2"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent">
                              <Icon className="h-4 w-4 text-accent-foreground" strokeWidth={1.75} />
                            </div>
                            <div>
                              <p className="text-[13.5px] font-semibold text-foreground">
                                {a.title}
                              </p>
                              <p className="text-[11.5px] text-muted-foreground capitalize">
                                {a.type}
                              </p>
                            </div>
                          </Link>
                          <div className="flex items-center gap-1">
                            {a.pinned ? <ClayBadge tone="amber"><Pin className="h-3 w-3" /> Pinned</ClayBadge> : null}
                            {a.to_do === 'yes' ? (
                              <ClayBadge tone="blue">
                                <CheckSquare className="h-3 w-3" /> To-do
                              </ClayBadge>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex justify-end gap-1">
                          <ClayButton variant="ghost" size="sm" onClick={() => handlePin(a._id)}>
                            {a.pinned ? 'Unpin' : 'Pin'}
                          </ClayButton>
                          <ClayButton variant="ghost" size="sm" onClick={() => handleDelete(a._id)}>
                            Delete
                          </ClayButton>
                        </div>
                      </ClayCard>
                    );
                  })}
                </div>
              </ClayCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
