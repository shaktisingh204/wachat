"use client";

import * as React from "react";

import { ZoruFileCardCollections } from "../file-card-collections";

import type { ZoruFileEntity } from "./types";

export interface ZoruFileListProps {
  files: ZoruFileEntity[];
  onOpen?: (file: ZoruFileEntity) => void;
  onAction?: (file: ZoruFileEntity) => void;
  empty?: React.ReactNode;
  className?: string;
}

export function ZoruFileList({
  files,
  onOpen,
  onAction,
  empty,
  className,
}: ZoruFileListProps) {
  return (
    <ZoruFileCardCollections
      view="list"
      items={files}
      onItemClick={onOpen}
      onItemAction={onAction}
      empty={empty}
      className={className}
    />
  );
}
