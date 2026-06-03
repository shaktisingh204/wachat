import { type DataMessagePart } from './DataMessagePart';
import { type UIMessagePart, type UITools } from 'ai';

export type ExtendedUIMessagePart = UIMessagePart<DataMessagePart, UITools>;
