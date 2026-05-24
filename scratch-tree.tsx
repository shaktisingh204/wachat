const permissionTree = [
    {
        id: 'crm',
        name: 'CRM Modules',
        children: [
            { id: 'contacts', name: 'Contacts & Leads', actions: ['view', 'create', 'edit', 'delete', 'export'] },
            { id: 'accounts', name: 'Accounts (Companies)', actions: ['view', 'create', 'edit', 'delete', 'export'] },
            { id: 'deals', name: 'Deals Pipeline', actions: ['view', 'create', 'edit', 'delete', 'change_stage'] }
        ]
    },
    {
        id: 'team',
        name: 'Team & Productivity',
        children: [
            { id: 'tasks', name: 'Tasks', actions: ['view', 'create', 'edit', 'delete', 'assign'] },
            { id: 'team_chat', name: 'Team Chat', actions: ['view', 'create', 'edit', 'delete', 'manage_channels'] }
        ]
    },
    {
        id: 'system',
        name: 'System',
        children: [
            { id: 'automations', name: 'Automations', actions: ['view', 'create', 'edit', 'delete', 'execute'] },
            { id: 'reports', name: 'Reports', actions: ['view', 'create', 'edit', 'delete', 'export'] },
            { id: 'settings', name: 'CRM Settings', actions: ['view', 'edit', 'manage_billing'] }
        ]
    }
];
