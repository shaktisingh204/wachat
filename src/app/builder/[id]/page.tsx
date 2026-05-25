import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { redirect } from 'next/navigation';
import { EditorLayout } from '@/components/builder/editor-layout';
import { EditorProvider } from '@/components/builder/editor-provider';
import { PageData } from '@/lib/builder/builder-types';
import { BuilderInitializer } from './builder-initializer';

async function getPageData(id: string, projectId: string): Promise<PageData | null> {
    const { db } = await connectToDatabase();
    // Authorized: only fetch the page if it belongs to the current user's active project
    const page = await db.collection('pages').findOne({ id, projectId });
    return page as PageData | null;
}

export default async function BuilderPage(props: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session?.user) {
        redirect('/login');
    }

    const projectId = session.user.activeProjectId;
    if (!projectId) {
        redirect('/dashboard');
    }

    const params = await props.params;
    const { id } = params;

    let pageData = await getPageData(id, projectId);

    if (!pageData) {
        pageData = {
            id: id,
            userId: session.user._id.toString(),
            projectId: projectId,
            title: 'New Page',
            elements: [],
            settings: {}
        } as any;
    }

    return (
        <EditorProvider>
            <BuilderInitializer initialData={pageData} projectId={projectId} />
        </EditorProvider>
    );
}
