// /src/app/api/crm/forms/embed/[formId]/route.js

import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
    const rawFormId = params.formId;
    const formIdFromServer = rawFormId.endsWith('.js') ? rawFormId.slice(0, -3) : rawFormId;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!formIdFromServer) {
        return new NextResponse('Form ID not provided.', { status: 400 });
    }
    
    if (!appUrl) {
         return new NextResponse('App URL not configured.', { status: 500 });
    }

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

    // --- Helper Functions ---
    function createEl(tag, props, children) {
        const el = document.createElement(tag);
        Object.entries(props).forEach(([key, value]) => {
            if (key === 'style' && typeof value === 'object') {
                Object.assign(el.style, value);
            } else if (key.startsWith('data-')) {
                el.setAttribute(key, value);
            }
            else {
                el[key] = value;
            }
        });
        if (children) {
            children.forEach(child => {
                if (typeof child === 'string') {
                    el.appendChild(document.createTextNode(child));
                } else if (child) {
                    el.appendChild(child);
                }
            });
        }
        return el;
    }

    function renderField(field, settings) {
        const fieldName = field.fieldId || field.id;
        const sizeClasses = { sm: 'h-8 text-xs', md: 'h-10 text-sm', lg: 'h-12 text-base'}[field.size || 'md'];
        const commonProps = { id: 'sabnode-' + fieldName, name: fieldName, placeholder: field.placeholder, className: 'sabnode-form-field ' + sizeClasses, required: field.required };
        
        let inputElement;

        switch (field.type) {
            case 'textarea':
                inputElement = createEl('textarea', { ...commonProps, rows: 4 });
                break;
            case 'select':
                inputElement = createEl('select', { ...commonProps }, (field.options || '').split('\\n').map(o => createEl('option', { value: o.trim(), textContent: o.trim() })));
                break;
            case 'radio':
                inputElement = createEl('div', { className: 'sabnode-radio-group' }, (field.options || '').split('\\n').map(o => {
                    const optId = 'sabnode-' + fieldName + '-' + o.trim();
                    return createEl('div', { className: 'sabnode-radio-item' }, [
                        createEl('input', { type: 'radio', id: optId, name: fieldName, value: o.trim() }),
                        createEl('label', { htmlFor: optId, textContent: o.trim() })
                    ]);
                }));
                break;
            case 'checkbox':
                inputElement = createEl('div', { className: 'sabnode-checkbox-item' }, [
                    createEl('input', { type: 'checkbox', id: commonProps.id, name: fieldName, required: field.required }),
                    createEl('label', { htmlFor: commonProps.id, textContent: field.label })
                ]);
                // For checkbox, the main label is part of the element, so we return early.
                return inputElement;
            default:
                inputElement = createEl('input', { ...commonProps, type: field.type || 'text' });
        }
        
        const label = field.labelPosition !== 'hidden' ? createEl('label', { htmlFor: commonProps.id, textContent: field.label + (field.required ? ' *' : '') }) : null;
        
        const fieldContainer = createEl('div', { className: 'sabnode-field-wrapper sabnode-field-type-' + field.type}, [
            label,
            inputElement,
        ]);
        
        return fieldContainer;
    }


    // --- Main Logic ---
    fetch('${appUrl}/api/crm/forms/data/' + formId)
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch form data.');
            return response.json();
        })
        .then(form => {
            if (!form) throw new Error('Form configuration not found.');
            
            const settings = form.settings || {};
            const formEl = createEl('form', { noValidate: true });
            
            // Apply dynamic styles
            const styleEl = createEl('style', {});
            styleEl.textContent = \`
              #sabnode-form-\${formId} .sabnode-form-field {
                color: \${settings.fieldColor};
                background-color: \${settings.fieldBgColor};
                border-color: \${settings.fieldBorderColor};
                border-radius: \${settings.fieldBorderRadius}px;
                padding: \${settings.fieldPadding}px;
                border-width: \${settings.fieldBorderWidth || 1}px;
                border-style: \${settings.fieldBorderType || 'solid'};
                width: 100%;
              }
              #sabnode-form-\${formId} .submit-button {
                color: \${settings.buttonColor};
                background-color: \${settings.buttonBgColor};
                border-radius: \${settings.buttonBorderRadius}px;
                padding: \${settings.buttonPadding}px;
                border: none;
              }
            \`;
            document.head.appendChild(styleEl);

            if (settings.logoUrl) {
                formEl.appendChild(createEl('img', { src: settings.logoUrl, alt: 'Logo', style: { margin: '0 auto 1rem', height: '60px', objectFit: 'contain' }}));
            }
            if (settings.title) {
                formEl.appendChild(createEl('h2', { textContent: settings.title, style: { textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}));
            }
             if (settings.description) {
                formEl.appendChild(createEl('p', { textContent: settings.description, style: { textAlign: 'center', color: '#666', marginBottom: '1.5rem' }}));
            }

            const fieldsContainer = createEl('div', { style: { display: 'grid', gridTemplateColumns: '1fr', gap: \`\${settings.fieldSpacing || 16}px\` }});
            (settings.fields || []).forEach(field => {
                fieldsContainer.appendChild(renderField(field, settings));
            });
            formEl.appendChild(fieldsContainer);

            const submitButton = createEl('button', { type: 'submit', className: 'submit-button', textContent: settings.submitButtonText || 'Submit', style: { width: '100%', marginTop: '1.5rem' } });
            formEl.appendChild(submitButton);

            if (settings.footerText) {
                const footer = createEl('div', { style: { textAlign: 'center', fontSize: '0.75rem', color: '#999', marginTop: '1rem' }});
                footer.innerHTML = settings.footerText;
                formEl.appendChild(footer);
            }

            formEl.addEventListener('submit', (e) => {
                e.preventDefault();
                submitButton.textContent = 'Submitting...';
                submitButton.disabled = true;

                const formData = new FormData(formEl);
                const data = Object.fromEntries(formData.entries());
                
                fetch('${appUrl}/api/crm/forms/submit/' + formId, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                })
                .then(res => res.json())
                .then(result => {
                    if (result.error) throw new Error(result.error);
                    formContainer.innerHTML = '<div style="padding: 2rem; text-align: center; border: 1px solid #ccc; border-radius: 8px;">' + (result.message || 'Submission successful!') + '</div>';
                })
                .catch(err => {
                    submitButton.textContent = 'Submit';
                    submitButton.disabled = false;
                    const errorEl = createEl('div', { textContent: err.message, style: { color: 'red', marginTop: '10px' }});
                    formEl.appendChild(errorEl);
                });
            });

            formContainer.innerHTML = ''; // Clear previous content
            formContainer.appendChild(formEl);
            formContainer.id = 'sabnode-form-' + formId;
            if (settings.formWidth) {
                formContainer.style.maxWidth = \`\${settings.formWidth}px\`;
            }
            formContainer.style.margin = '0 auto';

        })
        .catch(error => {
            console.error('SabNode Forms: Error loading form.', error);
            formContainer.textContent = 'Error loading form.';
        });
})();
    `;

    return new NextResponse(script, {
        headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
        },
    });
}
