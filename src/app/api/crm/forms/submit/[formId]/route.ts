
import { NextRequest, NextResponse } from 'next/server';
import { handleFormSubmission } from '@/app/actions/crm-forms.actions';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(
    request: NextRequest,
    { params }: { params: { formId: string } }
) {
    const { formId } = params;
    
    let formData;
    try {
        formData = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: corsHeaders });
    }

    try {
        const result = await handleFormSubmission(formId, formData);
        
        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Submission failed.' }, { status: 400, headers: corsHeaders });
        }

        return NextResponse.json({ success: true, message: result.message }, { headers: corsHeaders });

    } catch (e: any) {
        console.error("CRM Form Submission API Error:", e);
        return NextResponse.json({ error: e.message || 'An internal server error occurred.' }, { status: 500, headers: corsHeaders });
    }
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders
    });
}
