import {
  ZoruCard,
  ZoruCardContent,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruPageDescription,
} from '@/components/zoruui';
import {
  createDltTemplate,
  getDltTemplates,
  deleteDltTemplate } from "@/app/actions/sms-template.actions";
import { PlusCircle,
  Trash2 } from "lucide-react";

export default async function DltTemplatesPage() {
    const templates = await getDltTemplates();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <ZoruPageHeader>
                    <ZoruPageHeading>
                        <ZoruPageTitle>DLT Templates</ZoruPageTitle>
                        <ZoruPageDescription>
                            Manage your TRAI-approved DLT templates. These are required to send SMS in India.
                        </ZoruPageDescription>
                    </ZoruPageHeading>
                </ZoruPageHeader>

                <ZoruDialog>
                    <ZoruDialogTrigger asChild>
                        <ZoruButton>
                            <PlusCircle className="h-4 w-4" />
                            Add Template
                        </ZoruButton>
                    </ZoruDialogTrigger>
                    <ZoruDialogContent className="sm:max-w-[425px]">
                        <form action={createDltTemplate as any}>
                            <ZoruDialogHeader>
                                <ZoruDialogTitle>Add DLT Template</ZoruDialogTitle>
                                <ZoruDialogDescription>
                                    Enter the details exactly as approved in your DLT portal.
                                </ZoruDialogDescription>
                            </ZoruDialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <ZoruLabel htmlFor="name" className="text-right">Name</ZoruLabel>
                                    <ZoruInput id="name" name="name" placeholder="OTP Template" className="col-span-3" required />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <ZoruLabel htmlFor="dltTemplateId" className="text-right">DLT ID</ZoruLabel>
                                    <ZoruInput id="dltTemplateId" name="dltTemplateId" placeholder="1007..." className="col-span-3" required />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <ZoruLabel htmlFor="headerId" className="text-right">Header</ZoruLabel>
                                    <ZoruInput id="headerId" name="headerId" placeholder="WACHAT" maxLength={6} className="col-span-3" required />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <ZoruLabel htmlFor="type" className="text-right">Type</ZoruLabel>
                                    <select id="type" name="type" className="col-span-3 flex h-9 w-full rounded-md border border-zoru-line bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zoru-line disabled:cursor-not-allowed disabled:opacity-50">
                                        <option value="Transactional">Transactional</option>
                                        <option value="Service">Service</option>
                                        <option value="Promotional">Promotional</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <ZoruLabel htmlFor="content" className="text-right">Content</ZoruLabel>
                                    <ZoruTextarea id="content" name="content" placeholder="Your OTP is {#var#}. Valid for 10 mins." className="col-span-3" required />
                                </div>
                                <p className="text-xs text-zoru-ink-muted col-span-4 text-center">
                                    Use <code>{'{#var#}'}</code> for variables.
                                </p>
                            </div>
                            <ZoruDialogFooter>
                                <ZoruButton type="submit">Save Template</ZoruButton>
                            </ZoruDialogFooter>
                        </form>
                    </ZoruDialogContent>
                </ZoruDialog>
            </div>

            <ZoruCard className="p-0">
                <ZoruCardContent className="p-0">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow>
                                <ZoruTableHead>Name</ZoruTableHead>
                                <ZoruTableHead>DLT ID</ZoruTableHead>
                                <ZoruTableHead>Header</ZoruTableHead>
                                <ZoruTableHead>Content</ZoruTableHead>
                                <ZoruTableHead className="w-[100px]">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {templates.length === 0 && (
                                <ZoruTableRow>
                                    <ZoruTableCell colSpan={5} className="text-center h-24 text-zoru-ink-muted">
                                        No templates found. Add one to get started.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                            {templates.map((template: any) => (
                                <ZoruTableRow key={template._id}>
                                    <ZoruTableCell className="text-zoru-ink">{template.name}</ZoruTableCell>
                                    <ZoruTableCell>{template.dltTemplateId}</ZoruTableCell>
                                    <ZoruTableCell>{template.headerId}</ZoruTableCell>
                                    <ZoruTableCell className="max-w-[300px] truncate" title={template.content}>{template.content}</ZoruTableCell>
                                    <ZoruTableCell>
                                        <form action={async () => {
                                            'use server';
                                            await deleteDltTemplate(template._id);
                                        }}>
                                            <ZoruButton variant="ghost" size="icon" type="submit">
                                                <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                                            </ZoruButton>
                                        </form>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ))}
                        </ZoruTableBody>
                    </ZoruTable>
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
