import { getStarred } from '@/app/actions/sabfiles.actions';
import { SimpleList } from '../_components/simple-list';

export default async function SabFilesStarredPage() {
    const { nodes } = await getStarred();
    return (
        <SimpleList
            initialNodes={nodes}
            mode="starred"
            title="Starred"
            emptyHint="Star files and folders to find them here quickly."
        />
    );
}
