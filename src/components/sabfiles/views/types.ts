/**
 * Shared UI-facing types for the redesigned SabFiles surfaces.
 *
 * These are the shapes the new `views/*` components consume. The raw
 * Rust-client types live in `@/lib/rust-client/sabfiles`; the enriched
 * member/rollup shapes below are produced by the SabFiles server actions
 * (profile join + folder aggregation) and flow into the cards/table/panel.
 */
import type { SabfilesNode } from '@/lib/rust-client/sabfiles';

export type { SabfilesNode };

/** Collaboration role on a file/folder. Owner is implicit (the node's userId). */
export type SabFileRole = 'owner' | 'editor' | 'viewer';

/** A collaborator on a node, enriched with profile fields for rendering. */
export interface SabFileMember {
    userId: string;
    name: string;
    email: string;
    image?: string;
    role: SabFileRole;
    isOwner?: boolean;
}

/** Recursive aggregate for a folder card ("N files · X used"). */
export interface SabFolderRollup {
    fileCount: number;
    totalBytes: number;
}

/** Map of folder node id → its rollup. */
export type SabFolderRollupMap = Record<string, SabFolderRollup>;

/** File browser layout mode. */
export type SabFileView = 'grid' | 'list';
