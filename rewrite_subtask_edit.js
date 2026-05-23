const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/dashboard/crm/projects/subtasks/[id]/edit/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import \{ getSubtaskById \} from '@\/app\/actions\/crm-subtasks\.actions';/, `import { getWsSubTaskById } from '@/app/actions/worksuite/projects.actions';`);
content = content.replace(/const subtask = await getSubtaskById\(id\);/, `const subtask = await getWsSubTaskById(id);`);

fs.writeFileSync(file, content);
console.log('done!');
