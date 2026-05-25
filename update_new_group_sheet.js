const fs = require('fs');

const file = 'src/app/dashboard/hrm/permission-groups/_components/new-group-sheet.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /<div className="space-y-2">\s*<Label htmlFor="new-grp-name">[\s\S]*?<PermissionMatrix value={permissions} onChange={setPermissions} \/>\s*<\/div>/m,
  `<GroupForm
            name={name}
            description={description}
            permissions={permissions}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onPermissionsChange={setPermissions}
          />`
);

fs.writeFileSync(file, content);
