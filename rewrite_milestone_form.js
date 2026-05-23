const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/dashboard/crm/projects/milestones/_components/milestone-form.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace imports and use WsProjectMilestone
content = content.replace(/import \{ saveMilestone \} from '@\/app\/actions\/crm-milestones\.actions';/, `import { saveWsProjectMilestone } from '@/app/actions/worksuite/projects.actions';`);
content = content.replace(/import type \{[\s\S]*?\} from '@\/lib\/rust-client\/crm-milestones';/, `import type { WsProjectMilestone } from '@/lib/worksuite/project-types';`);

content = content.replace(/CrmMilestoneDoc/g, `WsProjectMilestone & { _id?: string }`);

content = content.replace(/const \[state, formAction\] = useActionState\(saveMilestone, \{\}\);/, `const [state, formAction] = useActionState(saveWsProjectMilestone, {} as any);`);

content = content.replace(/const \[status, setStatus\] = useState<CrmMilestoneStatus>\(\n\s*initialData\?.status \?\? 'planned',\n\s*\);/, `const [status, setStatus] = useState<string>(\n        initialData?.status ?? 'incomplete',\n    );`);
content = content.replace(/const \[priority, setPriority\] = useState<CrmMilestonePriority>\(\n\s*initialData\?.priority \?\? 'medium',\n\s*\);/, ``);
content = content.replace(/<input type="hidden" name="priority" value=\{priority\} \/>\n/, ``);
content = content.replace(/name="milestoneId"/, `name="_id"`);

// Name -> milestoneTitle
content = content.replace(/id="name"/, `id="milestoneTitle"`);
content = content.replace(/name="name"/, `name="milestoneTitle"`);
content = content.replace(/defaultValue=\{initialData\?.name \?\? ''\}/, `defaultValue={initialData?.milestoneTitle ?? ''}`);

// summary
content = content.replace(/id="description"/g, `id="summary"`);
content = content.replace(/name="description"/g, `name="summary"`);
content = content.replace(/defaultValue=\{initialData\?.description \?\? ''\}/, `defaultValue={initialData?.summary ?? ''}`);

// dates
content = content.replace(/defaultValue=\{toDateInput\(initialData\?.dueDate\)\}/, `defaultValue={toDateInput(initialData?.endDate)}`);
content = content.replace(/id="dueDate"/g, `id="endDate"`);
content = content.replace(/name="dueDate"/g, `name="endDate"`);

// Replace Progress / Priority with Cost / Currency
content = content.replace(/<div className="grid gap-4 sm:grid-cols-2">[\s\S]*?<div className="space-y-1.5">\n\s*<Label>Priority<\/Label>[\s\S]*?<\/div>\n\s*<\/div>/, `
                {/* Cost + Currency */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="cost">Cost / payment</Label>
                        <Input
                            id="cost"
                            name="cost"
                            type="number"
                            step="0.01"
                            defaultValue={initialData?.cost ? String(initialData.cost) : ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="currency">Currency</Label>
                        <Input
                            id="currency"
                            name="currency"
                            defaultValue={initialData?.currency ?? 'INR'}
                        />
                    </div>
                </div>`);

// Status + Owner
content = content.replace(/<EnumFormField[\s\S]*?onChange=\{\(next\) =>\n\s*setStatus\(\(next \?\? 'planned'\) as CrmMilestoneStatus\)\n\s*\}\n\s*\/>/, `
                        <select
                            name="status"
                            id="status"
                            className="flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            <option value="incomplete">Incomplete</option>
                            <option value="complete">Complete</option>
                        </select>`);

content = content.replace(/<Label>Owner<\/Label>/, `<Label>Start Date</Label>`);
content = content.replace(/<EntityFormField[\s\S]*?initialId=\{initialData\?.ownerId\}[\s\S]*?\/>/, `<Input id="startDate" name="startDate" type="date" defaultValue={toDateInput(initialData?.startDate)} />`);

content = content.replace(/<div className="space-y-1.5">\n\s*<Label>Parent milestone<\/Label>[\s\S]*?<\/div>/, ``);
content = content.replace(/<div className="space-y-1.5">\n\s*<Label htmlFor="completedAt">Completed on<\/Label>[\s\S]*?<\/div>/, ``);

// Remove Tags
content = content.replace(/{\/\* Tags \*\/}[\s\S]*?<\/div>/, ``);

fs.writeFileSync(file, content);
console.log('done!');
