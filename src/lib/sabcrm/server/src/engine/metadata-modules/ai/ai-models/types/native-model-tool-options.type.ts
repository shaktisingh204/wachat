import { type NativeModelToolKey } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/native-model-tool-key.type';

export type NativeModelToolOptions = Partial<
  Record<NativeModelToolKey, boolean>
>;
