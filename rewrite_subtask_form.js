const fs = require('fs');
const file = '/Users/harshkhandelwal/Downloads/sabnode/src/app/dashboard/crm/projects/subtasks/_components/subtask-form.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace imports and use WsSubTask
content = content.replace(/import \{ saveSubtask \} from '@\/app\/actions\/crm-subtasks\.actions';/, `import { saveWsSubTask } from '@/app/actions/worksuite/projects.actions';`);
content = content.replace(/import type \{[\s\S]*?\} from '@\/lib\/rust-client\/crm-subtasks';/, `import type { WsSubTask } from '@/lib/worksuite/project-types';`);

content = content.replace(/CrmSubtaskDoc/g, `WsSubTask & { _id?: string }`);

content = content.replace(/const \[state, formAction\] = useActionState\(saveSubtask, \{\}\);/, `const [state, formAction] = useActionState(saveWsSubTask, {} as any);`);

content = content.replace(/const \[parentKind, setParentKind\] = useState<CrmSubtaskParentKind>\([\s\S]*?\);/, ``);
content = content.replace(/<input type="hidden" name="parentKind" value=\{parentKind\} \/>\n/, ``);
content = content.replace(/const \[status, setStatus\] = useState<CrmSubtaskStatus>\(\n\s*initialData\?.status \?\? 'todo',\n\s*\);/, `const [status, setStatus] = useState<string>(\n        initialData?.status ?? 'incomplete',\n    );`);

content = content.replace(/name="subtaskId"/, `name="_id"`);

// assignee -> assignedTo
content = content.replace(/name="assigneeId"/, `name="assignedTo"`);
content = content.replace(/initialId=\{initialData\?.assigneeId\}/, `initialId={initialData?.assignedTo ? String(initialData.assignedTo) : undefined}`);
content = content.replace(/placeholder="Pick an assignee"/, `dualWriteName="assignedToName"\n                            placeholder="Pick an assignee"`);

// Parent kind + parent picker
content = content.replace(/<div className="space-y-1.5">\n\s*<Label>Parent kind \*<\/Label>[\s\S]*?<\/div>/, `
                    <div className="space-y-1.5">
                        <Label>Project</Label>
                        <EntityFormField
                            entity="project"
                            name="projectId"
                            dualWriteName="projectName"
                            initialId={initialData?.projectId ? String(initialData.projectId) : undefined}
                            placeholder="Pick a project"
                        />
                    </div>`);

content = content.replace(/name="parentId"/, `name="taskId"`);
content = content.replace(/initialId=\{initialData\?.parentId\}/, `initialId={initialData?.taskId ? String(initialData.taskId) : undefined}\n                            allowCreate`);

// Order -> Start Date
content = content.replace(/<Label htmlFor="order">Order<\/Label>[\s\S]*?<\/div>/, `<Label htmlFor="startDate">Start date</Label>
                        <Input
                            id="startDate"
                            name="startDate"
                            type="date"
                            defaultValue={toDateInput(initialData?.startDate)}
                        />
                    </div>`);

// Status enum
content = content.replace(/<EnumFormField[\s\S]*?onChange=\{\(next\) =>\n\s*setStatus\(\(next \?\? 'todo'\) as CrmSubtaskStatus\)\n\s*\}\n\s*\/>/, `
                        <select
                            name="status"
                            id="status"
                            className="flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            <option value="incomplete">Incomplete</option>
                            <option value="todo">To Do</option>
                            <option value="in-progress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="completed">Completed</option>
                        </select>`);

// Add Dependency field below Due Date
content = content.replace(/<div className="space-y-1.5">\n\s*<Label htmlFor="dueDate">Due date<\/Label>[\s\S]*?<\/div>/, `$&
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Dependency</Label>
                        <EntityFormField
                            entity="subtask"
                            name="dependencyId"
                            initialId={initialData?.dependencyId ? String(initialData.dependencyId) : undefined}
                            placeholder="Pick predecessor subtask"
                        />
                    </div>`);

fs.writeFileSync(file, content);
console.log('done!');
