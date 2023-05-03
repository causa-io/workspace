import { ServiceConstructor } from '../service-cache/index.js';
import { WorkspaceContext } from './context.js';

/**
 * A constructor that workspace service classes should implement.
 */
export type WorkspaceServiceConstructor<T extends object> = ServiceConstructor<
  WorkspaceContext,
  T
>;
