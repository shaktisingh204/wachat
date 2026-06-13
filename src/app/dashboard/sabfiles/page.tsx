import { listNodes, getBreadcrumb, getFolderRollups } from '@/app/actions/sabfiles.actions';
import { FileManager } from './_components/file-manager';

export default async function SabFilesRootPage() {
    const [{ nodes }, { crumbs }, rollups] = await Promise.all([
        listNodes({ parent: 'root' }),
        getBreadcrumb('root'),
        getFolderRollups('root'),
    ]);
    return (
        <FileManager
            parentId={null}
            initialNodes={nodes}
            initialBreadcrumb={crumbs}
            initialRollups={rollups}
        />
    );
}
