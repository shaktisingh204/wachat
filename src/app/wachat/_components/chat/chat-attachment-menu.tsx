'use client'

import {
    Menu,
    MenuItem,
    MenuLabel,
    MenuSeparator,
    IconButton,
} from "@/components/sabcrm/20ui"
import { Plus, Image as ImageIcon, FileText, ClipboardList, ShoppingBag, IndianRupee } from "lucide-react"
import type { Project } from "@/lib/definitions"
import { WaPayIcon } from "@/components/zoruui-domain/custom-sidebar-components"

interface ChatAttachmentMenuProps {
    disabled?: boolean;
    onMediaSelect: (acceptType: string) => void;
    onTemplateSelect: () => void;
    onCatalogSelect: () => void;
    onRazorpaySelect: () => void;
    onWaPaySelect: () => void;
    project: Project;
}

const TILE_CLASS = "flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)]";
const SECTION_LABEL_CLASS = "text-xs font-normal px-2 py-1.5 uppercase tracking-wider text-[var(--st-text-tertiary)]";
const ITEM_CLASS = "gap-3 py-2 cursor-pointer";

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
        <Menu
            align="start"
            label="Attachments"
            className="w-56"
            trigger={
                <IconButton
                    label="Attach"
                    icon={Plus}
                    variant="ghost"
                    disabled={disabled}
                    className="shrink-0 rounded-full"
                />
            }
        >
            <MenuLabel className={SECTION_LABEL_CLASS}>
                Attachments
            </MenuLabel>

            <MenuItem onSelect={() => onMediaSelect('image/*,video/*')} className={ITEM_CLASS}>
                <span className={TILE_CLASS}>
                    <ImageIcon className="h-4 w-4" />
                </span>
                <span className="flex-1">Photos &amp; Videos</span>
            </MenuItem>

            <MenuItem onSelect={() => onMediaSelect('application/pdf')} className={ITEM_CLASS}>
                <span className={TILE_CLASS}>
                    <FileText className="h-4 w-4" />
                </span>
                <span className="flex-1">Document</span>
            </MenuItem>

            <MenuSeparator />

            <MenuItem onSelect={onTemplateSelect} className={ITEM_CLASS}>
                <span className={TILE_CLASS}>
                    <ClipboardList className="h-4 w-4" />
                </span>
                <span className="flex-1">Template</span>
            </MenuItem>

            {project?.catalogs && project.catalogs.length > 0 && (
                <MenuItem onSelect={onCatalogSelect} className={ITEM_CLASS}>
                    <span className={TILE_CLASS}>
                        <ShoppingBag className="h-4 w-4" />
                    </span>
                    <span className="flex-1">Catalog</span>
                </MenuItem>
            )}

            <MenuSeparator />
            <MenuLabel className={SECTION_LABEL_CLASS}>
                Payments
            </MenuLabel>

            <MenuItem onSelect={onRazorpaySelect} className={ITEM_CLASS}>
                <span className={TILE_CLASS}>
                    <IndianRupee className="h-4 w-4" />
                </span>
                <span className="flex-1">Razorpay Link</span>
            </MenuItem>

            <MenuItem onSelect={onWaPaySelect} className={ITEM_CLASS}>
                <span className={TILE_CLASS}>
                    <WaPayIcon className="h-4 w-4" />
                </span>
                <span className="flex-1">WhatsApp Pay</span>
            </MenuItem>
        </Menu>
    )
}
