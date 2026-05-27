import { getSession } from '@/app/actions/user.actions';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/lib/mongodb';
import { nanoid } from 'nanoid';
import { Button } from '@/components/zoruui';
import { Card, CardContent } from '@/components/zoruui';
import { PageHeader } from '@/components/zoruui';
import { EmptyState } from '@/components/zoruui';
import { LayoutDashboard, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BuilderRootPage() {
    const session = await getSession();
    if (!session?.user) {
        redirect('/login');
    }

    async function createProjectAction() {
        'use server';
        const currentSession = await getSession();
        if (!currentSession?.user) {
            redirect('/login');
        }

        const { db } = await connectToDatabase();
        const newId = nanoid(10);
        
        await db.collection('pages').insertOne({
            id: newId,
            userId: currentSession.user._id.toString(),
            title: 'Untitled Page',
            elements: [],
            settings: {},
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        redirect(`/builder/${newId}`);
    }

    return (
        <div className="container max-w-5xl mx-auto py-10 px-4">
            <PageHeader
                title="Page Builder"
                subtitle="Create and manage your custom pages using the drag-and-drop builder."
                icon={LayoutDashboard}
            />

            <div className="mt-8">
                <Card className="border-dashed border-2">
                    <CardContent className="pt-6">
                        <EmptyState
                            icon={LayoutDashboard}
                            title="Create a new page"
                            description="Start building your custom page from scratch with our powerful drag-and-drop editor."
                            action={
                                <form action={createProjectAction}>
                                    <Button type="submit" size="lg" className="mt-4 gap-2">
                                        <Plus className="h-4 w-4" />
                                        Create New Project
                                    </Button>
                                </form>
                            }
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
