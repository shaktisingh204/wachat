import { type InputSchema, type FunctionInput } from '../types/InputSchema';
import { type FunctionInput as FunctionInputType } from '../types/FunctionInput';
import { type InputJsonSchema } from '../../logic-function/input-json-schema.type';
import { isDefined } from '../../utils/validation/isDefined';

export const getFunctionInputFromInputSchema = (
  inputSchema: InputSchema | InputJsonSchema[],
): FunctionInputType => {
  return inputSchema.map((param) => {
    if (
      isDefined(param.type) &&
      ['string', 'number', 'boolean'].includes(param.type as string)
    ) {
      return param.enum && param.enum.length > 0 ? param.enum[0] : null;
    } else if (param.type === 'object') {
      const result: FunctionInputType = {};
      if (isDefined(param.properties)) {
        Object.entries(param.properties).forEach(([key, val]) => {
          result[key] = getFunctionInputFromInputSchema([val as InputJsonSchema])[0];
        });
      }
      return result;
    } else if (param.type === 'array' && isDefined(param.items)) {
      return [];
    }
    return null;
  });
};
