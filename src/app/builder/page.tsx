import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { redirect } from 'next/navigation';
import { nanoid } from 'nanoid';

export default async function BuilderRootPage() {
    const session = await getSession();
    if (!session?.user) {
        redirect('/login');
    }

    const { db } = await connectToDatabase();
    const newId = nanoid(10);
    
    await db.collection('pages').insertOne({
        id: newId,
        userId: session.user._id.toString(),
        title: 'Untitled Page',
        elements: [],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    redirect(`/builder/${newId}`);
}
