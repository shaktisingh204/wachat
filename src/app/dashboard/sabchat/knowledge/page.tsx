import {
    Card,
    ZoruCardContent,
    ZoruCardDescription,
    ZoruCardHeader,
    ZoruCardTitle,
} from '@/components/sabcrm/20ui/compat';
import {
    listPortals,
    listCategories,
    listArticles,
} from '@/app/actions/sabchat-knowledge.actions';
import type { KbArticleStatus } from '@/lib/rust-client/sabchat-knowledge';
import { KnowledgeClient } from './_components/knowledge-client';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: KbArticleStatus[] = ['draft', 'published', 'archived'];

export default async function SabChatKnowledgePage({
    searchParams,
}: {
    searchParams: Promise<{
        portalId?: string;
        status?: string;
        q?: string;
        selected?: string;
    }>;
}) {
    const sp = await searchParams;

    const portalsResp = await listPortals();
    const portals = portalsResp.items ?? [];

    const portalId = sp.portalId ?? portals[0]?._id;
    const status: KbArticleStatus | undefined = VALID_STATUSES.includes(
        sp.status as KbArticleStatus,
    )
        ? (sp.status as KbArticleStatus)
        : undefined;
    const q = sp.q?.trim() || undefined;

    const [categoriesResp, articlesResp] = portalId
        ? await Promise.all([
              listCategories(portalId),
              listArticles({ portalId, status, q }),
          ])
        : [
              { items: [] as Awaited<ReturnType<typeof listCategories>>['items'] },
              { items: [] as Awaited<ReturnType<typeof listArticles>>['items'] },
          ];

    return (
        <div className="zoruui flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>SabKnow — Knowledge Base</ZoruCardTitle>
                    <ZoruCardDescription>
                        Author help-center articles, organise them into portals and
                        categories, then publish to your widget. {portals.length}{' '}
                        portal(s).
                    </ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <KnowledgeClient
                        portals={portals}
                        selectedPortalId={portalId ?? ''}
                        status={status}
                        q={q ?? ''}
                        categories={categoriesResp.items ?? []}
                        articles={articlesResp.items ?? []}
                        initialSelectedArticleId={sp.selected}
                    />
                </ZoruCardContent>
            </Card>
        </div>
    );
}
