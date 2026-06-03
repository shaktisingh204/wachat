import { type FieldMetadataType } from '../../types/FieldMetadataType';
import { type LeafType, type NodeType } from '../workflow-schema/types/base-output-schema.type';

export type InputSchemaPropertyType = LeafType | NodeType | FieldMetadataType;

export type InputSchemaProperty = {
  type: InputSchemaPropertyType;
  enum?: string[];
  items?: InputSchemaProperty;
  properties?: Properties;
  multiline?: boolean;
  label?: string;
};

type Properties = {
  [name: string]: InputSchemaProperty;
};

export type InputSchema = InputSchemaProperty[];
