/**
 * Publish settings for a deck.
 *
 * Reads the existing publication (if any) and renders a form for slug +
 * custom CSS. The action + live status live in `_publish-form.tsx`.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import {
    Badge,
    Button,
    PageActions,
    PageDescription,
    PageEyebrow,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
} from '@/components/sabcrm/20ui';
import {
    getSabshowDeck,
    listSabshowPublications,
} from '@/app/actions/sabshow.actions';

import { PublishForm } from './_publish-form';

export const dynamic = 'force-dynamic';

interface PublishPageProps {
    params: Promise<{ deckId: string }>;
}

export default async function PublishPage({ params }: PublishPageProps) {
    const { deckId } = await params;
    const deck = await getSabshowDeck(deckId);
    if (!deck) notFound();
    const publications = await listSabshowPublications(deckId);
    const existing = publications[0] ?? null;

    return (
        <div className="20ui mx-auto w-full max-w-2xl space-y-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>{deck.title}</PageEyebrow>
                    <span className="flex items-center gap-2">
                        <PageTitle>Publish</PageTitle>
                        <Badge tone={existing ? 'success' : 'neutral'} kind={existing ? 'soft' : 'outline'}>
                            {existing ? 'Live' : 'Not published'}
                        </Badge>
                    </span>
                    <PageDescription>
                        Pick a public link and an optional theme override for the shared view.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button asChild variant="outline">
                        <Link href={`/dashboard/sabshow/${deckId}`}>
                            <ArrowLeft size={14} aria-hidden="true" />
                            Back to editor
                        </Link>
                    </Button>
                </PageActions>
            </PageHeader>

            <PublishForm deckId={deckId} existing={existing} />
        </div>
    );
}
