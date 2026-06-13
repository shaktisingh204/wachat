import { listNodes, getBreadcrumb, getFolderRollups } from '@/app/actions/sabfiles.actions';
import { FileManager } from '../../_components/file-manager';

export default async function SabFilesFolderPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const [{ nodes }, { crumbs }, rollups] = await Promise.all([
        listNodes({ parent: id }),
        getBreadcrumb(id),
        getFolderRollups(id),
    ]);
    return (
        <FileManager
            parentId={id}
            initialNodes={nodes}
            initialBreadcrumb={crumbs}
            initialRollups={rollups}
        />
    );
}
