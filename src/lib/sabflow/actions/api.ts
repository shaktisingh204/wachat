
export const apiActions = [
    {
        name: 'getRequest',
        label: 'GET Request',
        description: 'Make a GET request to an external API endpoint.',
        inputs: [
            { name: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/data', required: true },
            { name: 'headers', label: 'Headers (JSON)', type: 'textarea', placeholder: '{\n  "Authorization": "Bearer ..."\n}' },
            { name: 'queryParams', label: 'Query Parameters (JSON)', type: 'textarea', placeholder: '{\n  "id": "123",\n  "status": "active"\n}' },
        ]
    },
    {
        name: 'postRequest',
        label: 'POST Request',
        description: 'Make a POST request to an external API endpoint.',
        inputs: [
            { name: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/data', required: true },
            { name: 'headers', label: 'Headers (JSON)', type: 'textarea', placeholder: '{\n  "Content-Type": "application/json"\n}' },
            { name: 'body', label: 'Body (JSON)', type: 'textarea', placeholder: '{\n  "name": "New Item",\n  "value": 100\n}' },
        ]
    },
    {
        name: 'putRequest',
        label: 'PUT Request',
        description: 'Make a PUT request to an external API endpoint.',
        inputs: [
            { name: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/data/123', required: true },
            { name: 'headers', label: 'Headers (JSON)', type: 'textarea' },
            { name: 'body', label: 'Body (JSON)', type: 'textarea', placeholder: '{\n  "name": "Updated Item"\n}' },
        ]
    },
    {
        name: 'deleteRequest',
        label: 'DELETE Request',
        description: 'Make a DELETE request to an external API endpoint.',
        inputs: [
            { name: 'url', label: 'URL', type: 'text', placeholder: 'https://api.example.com/data/123', required: true },
            { name: 'headers', label: 'Headers (JSON)', type: 'textarea' },
        ]
    }
];
