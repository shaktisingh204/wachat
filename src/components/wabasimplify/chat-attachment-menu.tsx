
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Plus, Image as ImageIcon, FileText, ClipboardList, ShoppingBag, IndianRupee } from "lucide-react"
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
                    <Plus className="h-5 w-5 text-muted-foreground" />
                    <span className="sr-only">Attach</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56 p-2" sideOffset={10}>
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1.5 uppercase tracking-wider">
                    Attachments
                </DropdownMenuLabel>

                <DropdownMenuItem onClick={() => onMediaSelect('image/*,video/*')} className="gap-3 py-2 cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
                        <ImageIcon className="h-4 w-4" />
                    </div>
                    <span className="flex-1">Photos & Videos</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => onMediaSelect('application/pdf')} className="gap-3 py-2 cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                        <FileText className="h-4 w-4" />
                    </div>
                    <span className="flex-1">Document</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={onTemplateSelect} className="gap-3 py-2 cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
                        <ClipboardList className="h-4 w-4" />
                    </div>
                    <span className="flex-1">Template</span>
                </DropdownMenuItem>

                {project?.catalogs && project.catalogs.length > 0 && (
                    <DropdownMenuItem onClick={onCatalogSelect} className="gap-3 py-2 cursor-pointer">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400">
                            <ShoppingBag className="h-4 w-4" />
                        </div>
                        <span className="flex-1">Catalog</span>
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1.5 uppercase tracking-wider">
                    Payments
                </DropdownMenuLabel>

                <DropdownMenuItem onClick={onRazorpaySelect} className="gap-3 py-2 cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400">
                        <IndianRupee className="h-4 w-4" />
                    </div>
                    <span className="flex-1">Razorpay Link</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={onWaPaySelect} className="gap-3 py-2 cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400">
                        <WaPayIcon className="h-4 w-4" />
                    </div>
                    <span className="flex-1">WhatsApp Pay</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
