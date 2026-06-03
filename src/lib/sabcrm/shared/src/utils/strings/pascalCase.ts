import camelCase from 'lodash/camelCase';
import { capitalize } from '@/lib/sabcrm/shared/src/utils/strings/capitalize';

export const pascalCase = (str: string) => capitalize(camelCase(str));
