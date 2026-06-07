"use client";

import * as React from "react";

import { SabFileCardCollections } from "../file-card-collections";

import type { SabFileEntity } from "./types";

export interface SabFileGridProps {
  files: SabFileEntity[];
  onOpen?: (file: SabFileEntity) => void;
  onAction?: (file: SabFileEntity) => void;
  empty?: React.ReactNode;
  className?: string;
}

export function SabFileGrid({
  files,
  onOpen,
  onAction,
  empty,
  className,
}: SabFileGridProps) {
  return (
    <SabFileCardCollections
      view="grid"
      items={files}
      onItemClick={onOpen}
      onItemAction={onAction}
      empty={empty}
      className={className}
    />
  );
}
