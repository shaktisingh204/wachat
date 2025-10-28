
import { NextResponse } from 'next/server';
import { getCrmFormById } from '@/app/actions/crm-forms.actions';
import { ObjectId } from 'mongodb';

export async function GET(request: Request, { params }: { params: { formId: string } }) {
    const { formId } = params;

    if (!formId || !ObjectId.isValid(formId)) {
        return NextResponse.json({ error: 'Invalid form ID' }, { status: 400 });
    }

    try {
        const form = await getCrmFormById(formId);
        if (!form) {
            return NextResponse.json({ error: 'Form not found' }, { status: 404 });
        }
        
        // Only return public-safe data
        const { userId, ...safeFormData } = form;

        return NextResponse.json(safeFormData, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });
    } catch (error) {
        console.error("Failed to fetch form data:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
