export interface ZoruFileEntity {
  id: string;
  name: string;
  /** Mime type or extension. */
  mime?: string;
  size?: number;
  modified?: Date;
  thumbnailUrl?: string;
  /** Optional URL to the original asset (used by the preview dialog). */
  url?: string;
  ownerName?: string;
}

export type ZoruFileView = "grid" | "list";
