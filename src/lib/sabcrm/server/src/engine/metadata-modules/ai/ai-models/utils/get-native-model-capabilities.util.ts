import { type AiSdkPackage } from '@/lib/sabcrm/shared/src/ai/constants/ai-sdk-packages.const';

import { type NativeModelToolKey } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/native-model-tool-key.type';
import { getNativeModelToolsForSdkPackage } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/utils/get-native-model-tools-for-sdk-package.util';

export const getNativeModelCapabilities = (
  sdkPackage?: AiSdkPackage | null,
): Partial<Record<NativeModelToolKey, boolean>> | undefined => {
  const tools = getNativeModelToolsForSdkPackage(sdkPackage);
  const toolKeys = tools ? Object.keys(tools) : [];

  if (toolKeys.length === 0) {
    return undefined;
  }

  return Object.fromEntries(toolKeys.map((toolKey) => [toolKey, true]));
};
