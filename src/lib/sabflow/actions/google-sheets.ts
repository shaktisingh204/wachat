
export const googleSheetsActions = [
    {
        name: 'updatedOrEditedRow',
        label: 'On Row Updated/Edited',
        description: 'Triggers when a row is modified in the connected Google Sheet.',
        inputs: [], // This is a trigger, so no user-defined inputs
        isTrigger: true,
    },
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
];
