/**
 * Barrel for `src/lib/embed/*`.
 *
 * Importing from `@/lib/embed` keeps call-sites stable when individual
 * helper files are renamed or split.
 */

export type {
  WidgetConfig,
  EmbedToken,
  EmbedAllowlist,
  MobileSdkPayload,
  PushNotificationToken,
} from './types';

export {
  buildLoaderScript,
  buildLoaderHtml,
  type BuildLoaderOptions,
} from './widget-loader';

export {
  signEmbed,
  verifyEmbedSignature,
  canonicalize,
} from './sign';

export {
  createSubscription,
  sendPush,
  generateVapidKeys,
  type BrowserPushSubscription,
  type VapidKeys,
  type SendPushOptions,
  type SendPushResult,
} from './push';

export {
  buildExtensionManifest,
  type ChromeMv3Manifest,
  type ExtensionManifestOptions,
} from './extension-manifest';

export {
  encodeDeeplink,
  decodeDeeplink,
  deeplinkToWebPath,
  DEEPLINK_SCHEME,
  type Deeplink,
} from './deeplink';

export {
  createCodeVerifier,
  createCodeChallenge,
  createPkcePair,
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  type PkcePair,
  type BuildAuthorizeUrlInput,
  type ExchangeCodeInput,
  type OAuthTokenResponse,
} from './sso-mobile';
