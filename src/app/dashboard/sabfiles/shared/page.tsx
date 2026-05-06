import { getShared } from '@/app/actions/sabfiles.actions';
import { SimpleList } from '../_components/simple-list';

export default async function SabFilesSharedPage() {
    const { nodes } = await getShared();
    return (
        <SimpleList
            initialNodes={nodes}
            mode="shared"
            title="Shared by me"
            emptyHint="Items you share with a public link will appear here."
        />
    );
}
