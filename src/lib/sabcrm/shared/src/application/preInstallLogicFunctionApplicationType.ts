import type { SyncableEntityOptions } from './syncableEntityOptionsType';

export type PreInstallLogicFunctionApplicationManifest =
  SyncableEntityOptions & {
    universalIdentifier: string;
    shouldRunOnVersionUpgrade?: boolean;
  };
