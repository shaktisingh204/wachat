'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { PageData } from '@/lib/builder/builder-types';
import { SignJWT } from 'jose';
import { nanoid } from 'nanoid';

export async function savePageData(pageData: PageData) {
    const session = await getSession();
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const projectId = session.user.activeProjectId;
    if (!projectId) {
        throw new Error("No active project/workspace");
    }

    const { db } = await connectToDatabase();
    
    // Ensure the page belongs to the current user's workspace/project
    await db.collection('pages').updateOne(
        { id: pageData.id, projectId: projectId },
        { 
            $set: {
                title: pageData.title,
                elements: pageData.elements,
                settings: pageData.settings,
                updatedAt: new Date(),
                userId: session.user._id.toString()
            },
            $setOnInsert: {
                createdAt: new Date()
            }
        },
        { upsert: true }
    );

    return { success: true };
}

export async function getBuilderWsToken(pageId: string): Promise<string> {
    const session = await getSession();
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const workspaceId = session.user.activeProjectId;
    if (!workspaceId) {
        throw new Error("No active project/workspace");
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined');
    }

    const jti = nanoid();
    const token = await new SignJWT({
        sub: session.user._id.toString(),
        tid: workspaceId,
        docId: pageId,
        roles: ['owner', 'admin', 'editor'],
        jti,
    })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2m')
    .sign(new TextEncoder().encode(secret));
    
    return token;
}
