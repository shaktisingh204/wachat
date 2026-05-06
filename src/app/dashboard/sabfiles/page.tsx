import { listNodes, getBreadcrumb } from '@/app/actions/sabfiles.actions';
import { FileManager } from './_components/file-manager';

export default async function SabFilesRootPage() {
    const [{ nodes }, { crumbs }] = await Promise.all([
        listNodes({ parent: 'root' }),
        getBreadcrumb('root'),
    ]);
    return (
        <FileManager
            parentId={null}
            initialNodes={nodes}
            initialBreadcrumb={crumbs}
        />
    );
}
