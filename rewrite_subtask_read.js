const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/dashboard/crm/projects/subtasks/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import \{ getSubtaskById \} from '@\/app\/actions\/crm-subtasks\.actions';/, `import { getWsSubTaskById } from '@/app/actions/worksuite/projects.actions';`);
content = content.replace(/import type \{ CrmSubtaskParentKind \} from '@\/lib\/rust-client\/crm-subtasks';/, ``);
content = content.replace(/const subtask = await getSubtaskById\(id\);/, `const subtask = await getWsSubTaskById(id);`);

// Update field names
content = content.replace(/subtask\.parentId/g, `subtask.taskId`);
content = content.replace(/subtask\.parentKind/g, `'task'`);
content = content.replace(/subtask\.assigneeId/g, `subtask.assignedTo`);
content = content.replace(/subtask\.order/g, `0`);

fs.writeFileSync(file, content);
console.log('done!');
