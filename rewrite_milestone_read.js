const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/dashboard/crm/projects/milestones/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import \{ getMilestoneById \} from '@\/app\/actions\/crm-milestones\.actions';/, `import { getWsProjectMilestoneById } from '@/app/actions/worksuite/projects.actions';`);
content = content.replace(/import type \{ CrmMilestonePriority \} from '@\/lib\/rust-client\/crm-milestones';/, ``);
content = content.replace(/const milestone = await getMilestoneById\(id\);/, `const milestone = await getWsProjectMilestoneById(id);`);

// Update field names
content = content.replace(/milestone\.name/g, `milestone.milestoneTitle`);
content = content.replace(/milestone\.description/g, `milestone.summary`);
content = content.replace(/milestone\.dueDate/g, `milestone.endDate`);
content = content.replace(/milestone\.completedAt/g, `milestone.endDate`);
content = content.replace(/milestone\.ownerId/g, `milestone.userId`);
content = content.replace(/milestone\.parentId/g, `''`);
content = content.replace(/milestone\.priority/g, `'medium'`);
content = content.replace(/milestone\.tags/g, `[]`);

// progress -> cost mapping just for UI compatibility, or simply 0
content = content.replace(/milestone\.progress/g, `(milestone.status === 'complete' ? 100 : 0)`);

fs.writeFileSync(file, content);
console.log('done!');
