const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/dashboard/crm/projects/milestones/[id]/edit/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/import \{ getMilestoneById \} from '@\/app\/actions\/crm-milestones\.actions';/, `import { getWsProjectMilestoneById } from '@/app/actions/worksuite/projects.actions';`);
content = content.replace(/const milestone = await getMilestoneById\(id\);/, `const milestone = await getWsProjectMilestoneById(id);`);
content = content.replace(/title=\{\`Edit · \$\{milestone\.name\}\`\}/, `title={\`Edit · \${milestone.milestoneTitle}\`}`);

fs.writeFileSync(file, content);
console.log('done!');
