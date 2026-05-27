/**
 * Public surface of the SabLens client library — `ILensTransport`,
 * supporting types, and the default `MockTransport` implementation.
 */
export type {
  ILensTransport,
  LensAnnotation,
  LensAnnotationGeometry,
  LensAnnotationKind,
  LensChatMessage,
  LensFrame,
  LensSnapshotRequest,
  Unsubscribe,
} from './transport';

export { MockTransport } from './mock-transport';
