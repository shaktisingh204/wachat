import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Button } from '@/components/sabcrm/20ui';import { Plus, Image as ImageIcon, FileText, ClipboardList, ShoppingBag, IndianRupee } from "lucide-react"
import type { Project } from "@/lib/definitions"
import { WaPayIcon } from "./custom-sidebar-components"

interface ChatAttachmentMenuProps {
    disabled?: boolean;
    onMediaSelect: (acceptType: string) => void;
    onTemplateSelect: () => void;
    onCatalogSelect: () => void;
    onRazorpaySelect: () => void;
    onWaPaySelect: () => void;
    project: Project;
}

export function ChatAttachmentMenu({
    disabled,
    onMediaSelect,
    onTemplateSelect,
    onCatalogSelect,
    onRazorpaySelect,
    onWaPaySelect,
    project
}: ChatAttachmentMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" disabled={disabled}>
                    <Plus className="h-5 w-5 text-[var(--st-text-secondary)]" />
                    <span className="sr-only">Attach</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56 p-2" sideOffset={10}>
                <DropdownMenuLabel className="text-xs text-[var(--st-text-secondary)] font-normal px-2 py-1.5 uppercase tracking-wider">
                    Attachments
                </DropdownMenuLabel>

                <DropdownMenuItem onClick={() => onMediaSelect('image/*,video/*')} className="gap-3 py-2 cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
                        <ImageIcon className="h-4 w-4" />
                    </div>
                    <span className="flex-1">Photos & Videos</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => onMediaSelect('application/pdf')} className="gap-3 py-2 cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
                        <FileText className="h-4 w-4" />
                    </div>
                    <span className="flex-1">Document</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={onTemplateSelect} className="gap-3 py-2 cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
                        <ClipboardList className="h-4 w-4" />
                    </div>
                    <span className="flex-1">Template</span>
                </DropdownMenuItem>

                {project?.catalogs && project.catalogs.length > 0 && (
                    <DropdownMenuItem onClick={onCatalogSelect} className="gap-3 py-2 cursor-pointer">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
                            <ShoppingBag className="h-4 w-4" />
                        </div>
                        <span className="flex-1">Catalog</span>
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-[var(--st-text-secondary)] font-normal px-2 py-1.5 uppercase tracking-wider">
                    Payments
                </DropdownMenuLabel>

                <DropdownMenuItem onClick={onRazorpaySelect} className="gap-3 py-2 cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
                        <IndianRupee className="h-4 w-4" />
                    </div>
                    <span className="flex-1">Razorpay Link</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onWaPaySelect} className="gap-3 py-2 cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
                        <WaPayIcon className="h-4 w-4" />
                    </div>
                    <span className="flex-1">WhatsApp Pay</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
