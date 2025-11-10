
export const googleSheetsActions = [
    { 
        name: 'addRow', 
        label: 'Add Row', 
        description: 'Adds a new row to the end of a specified sheet.', 
        inputs: [
            { name: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', placeholder: 'The ID of your Google Sheet', required: true },
            { name: 'sheetName', label: 'Sheet Name', type: 'text', placeholder: 'e.g. Sheet1', required: true },
            { name: 'rowData', label: 'Row Data (comma-separated)', type: 'text', placeholder: 'e.g. {{trigger.name}}, {{trigger.email}}' }
        ]
    },
    { 
        name: 'updateRow', 
        label: 'Update Row', 
        description: 'Finds a row by a lookup value and updates it.', 
        inputs: [
            { name: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', required: true },
            { name: 'sheetName', label: 'Sheet Name', type: 'text', required: true },
            { name: 'lookupColumn', label: 'Lookup Column', type: 'text', placeholder: 'e.g. Email', required: true },
            { name: 'lookupValue', label: 'Lookup Value', type: 'text', placeholder: 'e.g. {{trigger.email}}', required: true },
            { name: 'updateData', label: 'Data to Update (JSON)', type: 'textarea', placeholder: '{ "Status": "Contacted" }' }
        ] 
    },
    { 
        name: 'getRow', 
        label: 'Get Row Data', 
        description: 'Retrieves data from a specific row.', 
        inputs: [
            { name: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', required: true },
            { name: 'sheetName', label: 'Sheet Name', type: 'text', required: true },
            { name: 'lookupColumn', label: 'Lookup Column', type: 'text', placeholder: 'e.g. Email', required: true },
            { name: 'lookupValue', label: 'Lookup Value', type: 'text', placeholder: 'e.g. {{trigger.email}}', required: true },
        ] 
    },
];
