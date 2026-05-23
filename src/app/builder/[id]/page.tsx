import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { redirect } from 'next/navigation';
import { EditorLayout } from '@/components/builder/editor-layout';
import { EditorProvider } from '@/components/builder/editor-provider';
import { PageData } from '@/lib/builder/builder-types';
import { BuilderInitializer } from './builder-initializer';

async function getPageData(id: string, userId: string): Promise<PageData | null> {
    const { db } = await connectToDatabase();
    const page = await db.collection('pages').findOne({ id, userId });
    return page as PageData | null;
}

export default async function BuilderPage(props: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session?.user) {
        redirect('/login');
    }

    const params = await props.params;
    const { id } = params;

    let pageData = await getPageData(id, session.user._id.toString());

    // If no page found, we might want to create a default one or just pass null to let client handle "New Page" state
    if (!pageData) {
        pageData = {
            id: id,
            userId: session.user._id.toString(),
            title: 'New Page',
            elements: [],
            settings: {}
        } as any;
    }

    return (
        <EditorProvider>
            <BuilderInitializer initialData={pageData} />
        </EditorProvider>
    );
}
