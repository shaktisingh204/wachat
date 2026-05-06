import { getRecent } from '@/app/actions/sabfiles.actions';
import { SimpleList } from '../_components/simple-list';

export default async function SabFilesRecentPage() {
    const { nodes } = await getRecent();
    return (
        <SimpleList
            initialNodes={nodes}
            mode="recent"
            title="Recent files"
            emptyHint="Your recently uploaded or modified files will appear here."
        />
    );
}
