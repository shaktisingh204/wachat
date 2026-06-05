'use client'

import {
    Menu,
    MenuItem,
    MenuLabel,
    MenuSeparator,
    Button
} from "@/components/sabcrm/20ui"
import { Plus, Image as ImageIcon, FileText, ClipboardList, ShoppingBag, IndianRupee } from "lucide-react"
import type { Project } from "@/lib/definitions"
import { WaPayIcon } from "@/components/zoruui-domain/custom-sidebar-components"

function cx(...a: Array<string | false | null | undefined>) { return a.filter(Boolean).join(' '); }

interface ChatAttachmentMenuProps {
    disabled?: boolean;
    onMediaSelect: (acceptType: string) => void;
    onTemplateSelect: () => void;
    onCatalogSelect: () => void;
    onRazorpaySelect: () => void;
    onWaPaySelect: () => void;
    project: Project;
}

const TILE_CLASS = "flex h-8 w-8 items-center justify-center rounded-lg";
const TILE_STYLE: React.CSSProperties = {
    backgroundColor: 'var(--st-bg-muted)',
    color: 'var(--st-text)',
};
const SECTION_LABEL_CLASS = "text-xs font-normal px-2 py-1.5 uppercase tracking-wider";
const SECTION_LABEL_STYLE: React.CSSProperties = { color: 'var(--st-text-tertiary)' };
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
                <Button
                    variant="ghost"
                    aria-label="Attach"
                    disabled={disabled}
                    className="h-9 w-9 shrink-0 rounded-full"
                >
                    <Plus className="h-5 w-5" style={{ color: 'var(--st-text-tertiary)' }} />
                    <span className="sr-only">Attach</span>
                </Button>
            }
        >
            <MenuLabel className={SECTION_LABEL_CLASS} style={SECTION_LABEL_STYLE}>
                Attachments
            </MenuLabel>

            <MenuItem onSelect={() => onMediaSelect('image/*,video/*')} className={ITEM_CLASS}>
                <span className={TILE_CLASS} style={TILE_STYLE}>
                    <ImageIcon className="h-4 w-4" />
                </span>
                <span className="flex-1">Photos &amp; Videos</span>
            </MenuItem>

            <MenuItem onSelect={() => onMediaSelect('application/pdf')} className={ITEM_CLASS}>
                <span className={TILE_CLASS} style={TILE_STYLE}>
                    <FileText className="h-4 w-4" />
                </span>
                <span className="flex-1">Document</span>
            </MenuItem>

            <MenuSeparator />

            <MenuItem onSelect={onTemplateSelect} className={ITEM_CLASS}>
                <span className={TILE_CLASS} style={TILE_STYLE}>
                    <ClipboardList className="h-4 w-4" />
                </span>
                <span className="flex-1">Template</span>
            </MenuItem>

            {project?.catalogs && project.catalogs.length > 0 && (
                <MenuItem onSelect={onCatalogSelect} className={ITEM_CLASS}>
                    <span className={TILE_CLASS} style={TILE_STYLE}>
                        <ShoppingBag className="h-4 w-4" />
                    </span>
                    <span className="flex-1">Catalog</span>
                </MenuItem>
            )}

            <MenuSeparator />
            <MenuLabel className={SECTION_LABEL_CLASS} style={SECTION_LABEL_STYLE}>
                Payments
            </MenuLabel>

            <MenuItem onSelect={onRazorpaySelect} className={ITEM_CLASS}>
                <span className={TILE_CLASS} style={TILE_STYLE}>
                    <IndianRupee className="h-4 w-4" />
                </span>
                <span className="flex-1">Razorpay Link</span>
            </MenuItem>

            <MenuItem onSelect={onWaPaySelect} className={ITEM_CLASS}>
                <span className={TILE_CLASS} style={TILE_STYLE}>
                    <WaPayIcon className="h-4 w-4" />
                </span>
                <span className="flex-1">WhatsApp Pay</span>
            </MenuItem>
        </Menu>
    )
}
