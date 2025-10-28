// /src/app/api/crm/forms/embed/[formId]/route.js

import { NextResponse } from 'next/server';
import { getCrmFormById } from '@/app/actions/crm-forms.actions';
import { ObjectId } from 'mongodb';


export async function GET(request, { params }) {
    const rawFormId = params.formId;
    const formIdFromServer = rawFormId.endsWith('.js') ? rawFormId.slice(0, -3) : rawFormId;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!formIdFromServer || !ObjectId.isValid(formIdFromServer)) {
        return new NextResponse('Form ID not provided or invalid.', { status: 400 });
    }
    
    if (!appUrl) {
         return new NextResponse('App URL not configured.', { status: 500 });
    }

    const form = await getCrmFormById(formIdFromServer);
    if (!form) {
        return new NextResponse('Form not found.', { status: 404 });
    }
    const settings = form.settings || {};
    
    const dynamicStyles = `
      #sabnode-form-iframe-${formIdFromServer} {
        border: none;
        width: 100%;
        height: 500px;
      }
    `;

    const script = `
(function() {
    const scriptTag = document.currentScript;
    const rawFormId = scriptTag.src.split('/').pop();
    const formId = rawFormId.endsWith('.js') ? rawFormId.slice(0, -3) : rawFormId;

    if (!formId) {
        console.error('SabNode Forms: Could not determine formId from script tag.');
        return;
    }
    
    const formContainer = document.querySelector('[data-sabnode-form-id="' + formId + '"]');
    if (!formContainer) {
        console.error('SabNode Forms: Container for formId ' + formId + ' not found.');
        return;
    }

    const styleTag = document.createElement('style');
    styleTag.innerHTML = \`${dynamicStyles}\`;
    document.head.appendChild(styleTag);
    
    const iframe = document.createElement('iframe');
    iframe.src = '${appUrl}/embed/crm-form/' + formId;
    iframe.id = 'sabnode-form-iframe-' + formId;
    
    formContainer.innerHTML = '';
    formContainer.appendChild(iframe);

    window.addEventListener('message', function(event) {
        if (event.origin !== new URL('${appUrl}').origin) return;

        if (event.data.type === 'sabnodeFormHeight' && event.data.formId === formId) {
            iframe.style.height = (event.data.height + 20) + 'px';
        }
    });
})();
    `;

    return new NextResponse(script, {
        headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
        },
    });
}
