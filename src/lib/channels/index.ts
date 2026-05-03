/**
 * Communication Channels barrel.
 *
 * Importing this module has the side-effect of registering every shipped
 * adapter into the registry. Application code that only needs the registry
 * APIs should import from `./registry` directly to avoid pulling adapter
 * code into edge bundles.
 */

export * from './types';
export * from './registry';
export * from './unified-inbox';
export * from './routing';
export * from './email-deliverability';

import { registerChannel } from './registry';
import voiceAdapter from './adapters/voice';
import rcsAdapter from './adapters/rcs';
import lineAdapter from './adapters/line';
import wechatAdapter from './adapters/wechat';
import imessageAdapter from './adapters/imessage';
import discordAdapter from './adapters/discord';
import webpushAdapter from './adapters/webpush';

// Self-register on first import. Idempotent — `registerChannel` overwrites.
registerChannel(voiceAdapter);
registerChannel(rcsAdapter);
registerChannel(lineAdapter);
registerChannel(wechatAdapter);
registerChannel(imessageAdapter);
registerChannel(discordAdapter);
registerChannel(webpushAdapter);

export {
    voiceAdapter,
    rcsAdapter,
    lineAdapter,
    wechatAdapter,
    imessageAdapter,
    discordAdapter,
    webpushAdapter,
};
