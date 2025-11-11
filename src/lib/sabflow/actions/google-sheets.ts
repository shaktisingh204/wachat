export const googleSheetsActions = [
    {
        name: 'updatedOrEditedRow',
        label: 'On Row Updated/Edited',
        description: 'Triggers when a row is added or modified in the selected sheet.',
        isTrigger: true,
        inputs: []
    },
    {
        name: 'addRow',
        label: 'Add Row',
        description: 'Adds a new row to a Google Sheet.',
        isTrigger: false,
        inputs: [
            { name: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', placeholder: 'The ID from your sheet URL', required: true },
            { name: 'sheetName', label: 'Sheet Name', type: 'text', placeholder: 'e.g. Sheet1', required: true },
            { name: 'rowData', label: 'Row Data (JSON Array)', type: 'textarea', placeholder: '["Value for A", "Value for B"]', required: true },
        ]
    }
];