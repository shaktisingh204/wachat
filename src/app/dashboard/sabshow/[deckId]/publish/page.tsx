/**
 * Publish settings for a deck.
 *
 * Reads the existing publication (if any) and renders a small form for
 * slug + custom CSS + theme. The action lives in `_publish-form.tsx`.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import {
    Button,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
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
        <div className="20ui mx-auto w-full max-w-2xl space-y-4 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>{deck.title}</PageTitle>
                    <PageDescription>Publish settings</PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link href={`/dashboard/sabshow/${deckId}`}>
                        <Button variant="outline" iconLeft={ArrowLeft}>
                            Back to editor
                        </Button>
                    </Link>
                </PageActions>
            </PageHeader>

            <PublishForm deckId={deckId} existing={existing} />
        </div>
    );
}
