import { getTrash } from '@/app/actions/sabfiles.actions';
import { SimpleList } from '../_components/simple-list';

export default async function SabFilesTrashPage() {
    const { nodes } = await getTrash();
    return (
        <SimpleList
            initialNodes={nodes}
            mode="trash"
            title="Trash"
            emptyHint="Items you delete are kept here so you can restore them."
        />
    );
}
