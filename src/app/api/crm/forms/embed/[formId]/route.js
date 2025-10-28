
// NOTE: This is a '.js' file because Next.js Route Handlers have better
// support for raw responses in JavaScript files.

import { NextResponse } from 'next/server';
import { getCrmFormById } from '@/app/actions/crm-forms.actions';

export async function GET(request, { params }) {
    const rawFormId = params.formId;
    const formId = rawFormId.endsWith('.js') ? rawFormId.slice(0, -3) : rawFormId;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!formId) {
        return new NextResponse('Form ID not provided.', { status: 400 });
    }
    
    if (!appUrl) {
         return new NextResponse('App URL not configured.', { status: 500 });
    }

    const script = `
(function() {
    const formContainer = document.querySelector('[data-sabnode-form-id="${formId}"]');
    if (!formContainer) {
        console.error('SabNode Forms: Container for formId ${formId} not found.');
        return;
    }
    
    const iframe = document.createElement('iframe');
    iframe.src = "${appUrl}/embed/crm-form/${formId}";
    iframe.style.width = '100%';
    iframe.style.height = '500px'; // Default height, can be adjusted
    iframe.style.border = 'none';
    iframe.scrolling = 'no';
    
    formContainer.innerHTML = '';
    formContainer.appendChild(iframe);
    
    // Adjust iframe height based on content
    window.addEventListener('message', function(event) {
        if (event.source !== iframe.contentWindow) return;
        
        const data = event.data;
        if(data.type === 'sabnodeFormHeight' && data.formId === '${formId}') {
            iframe.style.height = data.height + 'px';
        }
    });
})();
    `;

    return new NextResponse(script, {
        headers: {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
