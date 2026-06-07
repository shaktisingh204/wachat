"use client";

import * as React from "react";

import { SabFileCardCollections } from "../file-card-collections";

import type { SabFileEntity } from "./types";

export interface SabFileListProps {
  files: SabFileEntity[];
  onOpen?: (file: SabFileEntity) => void;
  onAction?: (file: SabFileEntity) => void;
  empty?: React.ReactNode;
  className?: string;
}

export function SabFileList({
  files,
  onOpen,
  onAction,
  empty,
  className,
}: SabFileListProps) {
  return (
    <SabFileCardCollections
      view="list"
      items={files}
      onItemClick={onOpen}
      onItemAction={onAction}
      empty={empty}
      className={className}
    />
  );
}
