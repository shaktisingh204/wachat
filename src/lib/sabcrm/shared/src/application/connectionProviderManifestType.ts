import { type OAuthConnectionProviderConfig } from './oauthConnectionProviderConfigType';
import { type SyncableEntityOptions } from './syncableEntityOptionsType';

export type ConnectionProviderManifest = SyncableEntityOptions & {
  name: string;
  displayName: string;
  type: 'oauth';
  oauth: OAuthConnectionProviderConfig;
};
