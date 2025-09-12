
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/app/actions/api-keys.actions';
import { handleCreateTemplate } from '@/app/actions/template.actions';
import { checkRateLimit } from '@/lib/rate-limiter';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized: Missing API key.' }, { status: 401 });
    }
    const apiKey = authHeader.split(' ')[1];

    const authResult = await authenticateApiKey(apiKey);
    if (!authResult.success || !authResult.user) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const { user } = authResult;
    const { success: rateLimitSuccess, error: rateLimitError } = await checkRateLimit(`api:${user._id.toString()}`, 30, 60 * 1000); // 30 reqs/min for template creation
    if (!rateLimitSuccess) {
        return NextResponse.json({ error: rateLimitError }, { status: 429 });
    }

    try {
        const body = await request.json();
        const {
            projectId,
            name,
            category,
            language,
            body: bodyText,
            headerFormat = 'NONE',
            headerText,
            headerSampleUrl,
            footer,
            buttons = []
        } = body;

        if (!projectId || !name || !category || !language || !bodyText) {
            return NextResponse.json({ error: 'projectId, name, category, language, and body are required.' }, { status: 400 });
        }
        
        // --- Permission Check ---
        const { db } = await connectToDatabase();
        const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId), userId: user._id });
        if (!project) {
            return NextResponse.json({ error: 'You do not have permission to access this project.' }, { status: 403 });
        }

        const formData = new FormData();
        formData.append('projectId', projectId);
        formData.append('name', name);
        formData.append('category', category);
        formData.append('language', language);
        formData.append('body', bodyText);
        formData.append('headerFormat', headerFormat);
        if (headerText) formData.append('headerText', headerText);
        if (headerSampleUrl) formData.append('headerSampleUrl', headerSampleUrl);
        if (footer) formData.append('footer', footer);
        if (buttons) formData.append('buttons', JSON.stringify(buttons));
        
        const result = await handleCreateTemplate(null, formData);

        if (result.error) {
            return NextResponse.json({ error: result.error, payload: result.payload }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: result.message });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'An unexpected error occurred.' }, { status: 500 });
    }
}
