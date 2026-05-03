"use client";

import * as React from "react";

import { ZoruFileCardCollections } from "../file-card-collections";

import type { ZoruFileEntity } from "./types";

export interface ZoruFileGridProps {
  files: ZoruFileEntity[];
  onOpen?: (file: ZoruFileEntity) => void;
  onAction?: (file: ZoruFileEntity) => void;
  empty?: React.ReactNode;
  className?: string;
}

export function ZoruFileGrid({
  files,
  onOpen,
  onAction,
  empty,
  className,
}: ZoruFileGridProps) {
  return (
    <ZoruFileCardCollections
      view="grid"
      items={files}
      onItemClick={onOpen}
      onItemAction={onAction}
      empty={empty}
      className={className}
    />
  );
}
