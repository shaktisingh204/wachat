
import { connectToDatabase } from '@/lib/mongodb';
import { EditorLayout } from '@/components/builder/editor-layout';
import { EditorProvider } from '@/components/builder/editor-provider';
import { PageData } from '@/lib/builder/builder-types';
import { BuilderInitializer } from './builder-initializer';

async function getPageData(id: string): Promise<PageData | null> {
    const { db } = await connectToDatabase();
    const page = await db.collection('pages').findOne({ id });
    return page as PageData | null;
}

export default async function BuilderPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { id } = params;

    let pageData = await getPageData(id);

    // If no page found, we might want to create a default one or just pass null to let client handle "New Page" state
    if (!pageData) {
        pageData = {
            id: id,
            title: 'New Page',
            elements: [],
            settings: {}
        };
    }

    return (
        <EditorProvider>
            <BuilderInitializer initialData={pageData} />
        </EditorProvider>
    );
}
