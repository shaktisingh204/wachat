const permissionTree = [
    {
        id: 'crm',
        name: 'CRM Workspace',
        children: [
            {
                id: 'contacts',
                name: 'Contacts & Leads',
                actions: ['view', 'create', 'edit', 'delete', 'import', 'export']
            },
            {
                id: 'accounts',
                name: 'Accounts',
                actions: ['view', 'create', 'edit', 'delete', 'import', 'export']
            },
            {
                id: 'deals',
                name: 'Deals Pipeline',
                actions: ['view', 'create', 'edit', 'delete', 'change_stage']
            }
        ]
    },
    {
        id: 'team',
        name: 'Team & Collaboration',
        children: [
            {
                id: 'tasks',
                name: 'Tasks',
                actions: ['view', 'create', 'edit', 'delete', 'assign']
            },
            {
                id: 'team_chat',
                name: 'Team Chat',
                actions: ['view', 'create', 'edit', 'delete', 'manage_channels']
            }
        ]
    },
    {
        id: 'system',
        name: 'System & Settings',
        children: [
            {
                id: 'automations',
                name: 'Automations',
                actions: ['view', 'create', 'edit', 'delete', 'execute']
            },
            {
                id: 'reports',
                name: 'Reports & Analytics',
                actions: ['view', 'create', 'edit', 'delete', 'export']
            },
            {
                id: 'settings',
                name: 'CRM Settings',
                actions: ['view', 'edit_fields', 'manage_integrations']
            }
        ]
    }
];
