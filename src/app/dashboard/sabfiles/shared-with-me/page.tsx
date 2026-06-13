import { getSharedWithMe } from '@/app/actions/sabfiles.actions';
import { SimpleList } from '../_components/simple-list';

export default async function SabFilesSharedWithMePage() {
    const { nodes } = await getSharedWithMe();
    return (
        <SimpleList
            initialNodes={nodes}
            mode="shared-with-me"
            title="Shared with me"
            emptyHint="Files and folders other people share with you will appear here."
        />
    );
}
