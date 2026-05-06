import { listNodes, getBreadcrumb } from '@/app/actions/sabfiles.actions';
import { FileManager } from '../../_components/file-manager';

export default async function SabFilesFolderPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const [{ nodes }, { crumbs }] = await Promise.all([
        listNodes({ parent: id }),
        getBreadcrumb(id),
    ]);
    return (
        <FileManager
            parentId={id}
            initialNodes={nodes}
            initialBreadcrumb={crumbs}
        />
    );
}
